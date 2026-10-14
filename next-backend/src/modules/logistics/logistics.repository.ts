import { prisma } from "../../lib/prisma.js";
import { Prisma, ShipmentStatus, DeliveryMethod, OrderStatus } from "@prisma/client";
import type {
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CreateShipmentInput,
} from "@nextdor/shared";

export class LogisticsRepository {
  /**
   * Find matching active delivery zone for a destination.
   * Matches by postal code prefix, district, or region with ranking.
   */
  async findMatchingZone(criteria: {
    region: string;
    district?: string;
    postalCode?: string;
  }) {
    const cleanRegion = criteria.region.trim();
    const cleanDistrict = criteria.district?.trim().toLowerCase();
    const rawPostcode = criteria.postalCode?.trim().toUpperCase();
    // Extract GhanaPost GPS prefix (e.g. "GA" from "GA-183-9281")
    const prefix = rawPostcode ? rawPostcode.split(/[- ]/)[0] : undefined;

    // Fetch active zones in the given region or nationwide
    const zones = await prisma.deliveryZone.findMany({
      where: {
        isActive: true,
        OR: [
          { region: { equals: cleanRegion, mode: "insensitive" } },
          { region: { equals: "Nationwide", mode: "insensitive" } },
        ],
      },
      include: {
        rates: {
          where: { isActive: true },
        },
      },
    });

    if (zones.length === 0) return null;

    // Score and rank zones by specificity:
    // 1. Postcode prefix match (+100)
    // 2. District match (+50)
    // 3. Exact region match (+20)
    // 4. Nationwide (+1)
    const scored = zones.map((zone) => {
      let score = 0;
      if (prefix && zone.postCodePrefixes.some((p) => p.toUpperCase() === prefix)) {
        score += 100;
      }
      if (
        cleanDistrict &&
        zone.districts.some((d) => d.toLowerCase() === cleanDistrict)
      ) {
        score += 50;
      }
      if (zone.region.toLowerCase() === cleanRegion.toLowerCase()) {
        score += 20;
      } else if (zone.region.toLowerCase() === "nationwide") {
        score += 1;
      }
      return { zone, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.zone ?? null;
  }

  /**
   * List all zones with active rates.
   */
  async listZones() {
    return prisma.deliveryZone.findMany({
      include: { rates: true },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Find zone by UUID.
   */
  async findZoneById(id: string) {
    return prisma.deliveryZone.findUnique({
      where: { id },
      include: { rates: true },
    });
  }

  /**
   * Find zone by unique code.
   */
  async findZoneByCode(code: string) {
    return prisma.deliveryZone.findUnique({
      where: { code },
      include: { rates: true },
    });
  }

  /**
   * Create a delivery zone with rates.
   */
  async createZone(input: CreateDeliveryZoneInput) {
    return prisma.deliveryZone.create({
      data: {
        name: input.name,
        code: input.code.toUpperCase(),
        region: input.region,
        districts: input.districts ?? [],
        postCodePrefixes: (input.postCodePrefixes ?? []).map((p) => p.toUpperCase()),
        isActive: input.isActive ?? true,
        rates: {
          create: (input.rates ?? []).map((r) => ({
            deliveryMethod: r.deliveryMethod as DeliveryMethod,
            baseFee: new Prisma.Decimal(r.baseFee),
            perKgFee: new Prisma.Decimal(r.perKgFee ?? 0),
            minDays: r.minDays ?? 1,
            maxDays: r.maxDays ?? 3,
            isActive: r.isActive ?? true,
          })),
        },
      },
      include: { rates: true },
    });
  }

  /**
   * Update a delivery zone.
   */
  async updateZone(id: string, input: UpdateDeliveryZoneInput) {
    return prisma.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code ? input.code.toUpperCase() : undefined,
          region: input.region,
          districts: input.districts,
          postCodePrefixes: input.postCodePrefixes?.map((p) => p.toUpperCase()),
          isActive: input.isActive,
        },
      });

      if (input.rates && input.rates.length > 0) {
        for (const rate of input.rates) {
          await tx.deliveryRate.upsert({
            where: {
              zoneId_deliveryMethod: {
                zoneId: id,
                deliveryMethod: rate.deliveryMethod as DeliveryMethod,
              },
            },
            create: {
              zoneId: id,
              deliveryMethod: rate.deliveryMethod as DeliveryMethod,
              baseFee: new Prisma.Decimal(rate.baseFee),
              perKgFee: new Prisma.Decimal(rate.perKgFee ?? 0),
              minDays: rate.minDays ?? 1,
              maxDays: rate.maxDays ?? 3,
              isActive: rate.isActive ?? true,
            },
            update: {
              baseFee: new Prisma.Decimal(rate.baseFee),
              perKgFee: new Prisma.Decimal(rate.perKgFee ?? 0),
              minDays: rate.minDays ?? 1,
              maxDays: rate.maxDays ?? 3,
              isActive: rate.isActive ?? true,
            },
          });
        }
      }

      return tx.deliveryZone.findUnique({
        where: { id },
        include: { rates: true },
      });
    });
  }

  /**
   * Create a shipment and record initial milestone event.
   */
  async createShipment(input: CreateShipmentInput) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          orderId: input.orderId,
          carrier: input.carrier.toUpperCase(),
          trackingNumber: input.trackingNumber.trim(),
          trackingUrl: input.trackingUrl || null,
          courierName: input.courierName || null,
          courierPhone: input.courierPhone || null,
          dispatchNotes: input.dispatchNotes || null,
          estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
          status: "LABEL_CREATED",
          events: {
            create: {
              status: "LABEL_CREATED",
              location: "Logistics Hub",
              description: `Shipment label generated for ${input.carrier.toUpperCase()}`,
            },
          },
        },
        include: { events: true },
      });

      return shipment;
    });
  }

  /**
   * Find shipment by tracking number.
   */
  async findShipmentByTrackingNumber(trackingNumber: string) {
    return prisma.shipment.findUnique({
      where: { trackingNumber: trackingNumber.trim() },
      include: {
        events: { orderBy: { occurredAt: "desc" } },
        order: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });
  }

  /**
   * Find shipments for an order.
   */
  async findShipmentsByOrderId(orderId: string) {
    return prisma.shipment.findMany({
      where: { orderId },
      include: {
        events: { orderBy: { occurredAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Record shipment event and update shipment/order status atomically.
   */
  async updateShipmentStatus(params: {
    shipmentId: string;
    status: ShipmentStatus;
    location?: string;
    description?: string;
    rawPayload?: any;
    courierName?: string;
    courierPhone?: string;
    occurredAt?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findUniqueOrThrow({
        where: { id: params.shipmentId },
        include: { order: true },
      });

      const actualDelivery =
        params.status === "DELIVERED"
          ? (params.occurredAt ?? new Date())
          : existing.actualDelivery;

      // 1. Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: params.shipmentId },
        data: {
          status: params.status,
          actualDelivery,
          courierName: params.courierName ?? existing.courierName,
          courierPhone: params.courierPhone ?? existing.courierPhone,
          events: {
            create: {
              status: params.status,
              location: params.location || null,
              description: params.description || `Status updated to ${params.status}`,
              rawPayload: params.rawPayload ?? null,
              occurredAt: params.occurredAt ?? new Date(),
            },
          },
        },
        include: {
          events: { orderBy: { occurredAt: "desc" } },
          order: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
      });

      // 2. Propagate to Order status if applicable
      if (params.status === "DELIVERED" && existing.order.status !== "DELIVERED") {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: "DELIVERED" },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: existing.orderId,
            status: "DELIVERED",
            note: `Automated: Courier ${existing.carrier} marked package ${existing.trackingNumber} as DELIVERED`,
          },
        });
      } else if (
        (params.status === "OUT_FOR_DELIVERY" || params.status === "IN_TRANSIT") &&
        (existing.order.status === "CONFIRMED" || existing.order.status === "PROCESSING")
      ) {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: "SHIPPED" },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: existing.orderId,
            status: "SHIPPED",
            note: `Automated: Courier ${existing.carrier} marked shipment ${existing.trackingNumber} as ${params.status}`,
          },
        });
      }

      return updatedShipment;
    });
  }
}
