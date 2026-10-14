import { LogisticsRepository } from "./logistics.repository.js";
import { Money } from "../../domain/Money.js";
import { logger } from "../../lib/logger.js";
import { SmsService } from "../../lib/sms.js";
import { EmailService } from "../../lib/email.js";
import { dispatchEmailAsync } from "../../lib/email.queue.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../lib/errors.js";
import type { DeliveryMethod, ShipmentStatus } from "@prisma/client";
import type {
  DeliveryQuoteRequest,
  DeliveryQuoteOption,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CreateShipmentInput,
  CourierWebhookPayload,
} from "@nextdor/shared";

// Standard fallback rates in major GHS if no custom zone is configured
export const DEFAULT_RATES: Record<
  DeliveryMethod,
  { baseFee: number; minDays: number; maxDays: number }
> = {
  STANDARD: { baseFee: 25.0, minDays: 2, maxDays: 4 },
  EXPRESS: { baseFee: 50.0, minDays: 1, maxDays: 1 },
  PICKUP: { baseFee: 0.0, minDays: 1, maxDays: 2 },
};

export class LogisticsService {
  constructor(private readonly repo: LogisticsRepository) {}

  /**
   * Calculate dynamic delivery quote options based on customer destination & weight.
   */
  async calculateQuote(input: DeliveryQuoteRequest): Promise<DeliveryQuoteOption[]> {
    const zone = await this.repo.findMatchingZone({
      region: input.region,
      district: input.district,
      postalCode: input.digitalAddress || input.postcode,
    });

    const weightKg = Math.max(1, input.weightKg || 1);
    const methods: DeliveryMethod[] = input.method
      ? [input.method as DeliveryMethod]
      : ["STANDARD", "EXPRESS", "PICKUP"];

    if (!zone || !zone.rates || zone.rates.length === 0) {
      // Fallback to default platform rates
      return methods.map((method) => {
        const def = DEFAULT_RATES[method];
        return {
          method,
          baseFee: def.baseFee,
          weightFee: 0,
          totalFee: def.baseFee,
          minDays: def.minDays,
          maxDays: def.maxDays,
          zoneCode: "DEFAULT_GHANA",
          zoneName: "Standard Ghana Delivery",
        };
      });
    }

    const options: DeliveryQuoteOption[] = [];

    for (const method of methods) {
      const rate = zone.rates.find((r) => r.deliveryMethod === method && r.isActive);
      if (!rate) {
        // Fallback for this specific method
        const def = DEFAULT_RATES[method];
        options.push({
          method,
          baseFee: def.baseFee,
          weightFee: 0,
          totalFee: def.baseFee,
          minDays: def.minDays,
          maxDays: def.maxDays,
          zoneCode: zone.code,
          zoneName: zone.name,
        });
        continue;
      }

      const baseMoney = Money.fromMajor(Number(rate.baseFee));
      const perKgMoney = Money.fromMajor(Number(rate.perKgFee));
      const extraWeight = Math.max(0, Math.ceil(weightKg - 1));
      const weightMoney = perKgMoney.multiply(extraWeight);
      const totalMoney = baseMoney.add(weightMoney);

      options.push({
        method,
        baseFee: baseMoney.toMajor(),
        weightFee: weightMoney.toMajor(),
        totalFee: totalMoney.toMajor(),
        minDays: rate.minDays,
        maxDays: rate.maxDays,
        zoneCode: zone.code,
        zoneName: zone.name,
      });
    }

    return options;
  }

  /**
   * Resolve single delivery fee for checkout using Money to avoid rounding leaks.
   */
  async resolveCheckoutDeliveryFee(params: {
    region: string;
    district?: string;
    postalCode?: string;
    method: DeliveryMethod;
    weightKg?: number;
  }): Promise<Money> {
    const quotes = await this.calculateQuote({
      region: params.region,
      district: params.district,
      postcode: params.postalCode,
      weightKg: params.weightKg ?? 1,
      method: params.method,
    });

    const quote = quotes.find((q) => q.method === params.method) ?? quotes[0];
    return quote ? Money.fromMajor(quote.totalFee) : Money.fromMajor(DEFAULT_RATES[params.method].baseFee);
  }

  /**
   * Create new shipment dispatch record.
   */
  async dispatchShipment(input: CreateShipmentInput) {
    const existing = await this.repo.findShipmentByTrackingNumber(input.trackingNumber);
    if (existing) {
      throw new BadRequestError(`Shipment with tracking number ${input.trackingNumber} already exists`);
    }

    const shipment = await this.repo.createShipment(input);
    logger.info(
      {
        shipmentId: shipment.id,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        orderId: shipment.orderId,
      },
      "Shipment dispatched"
    );

    return shipment;
  }

  /**
   * Look up shipment and live tracking timeline by tracking number.
   */
  async trackShipment(trackingNumber: string) {
    const shipment = await this.repo.findShipmentByTrackingNumber(trackingNumber);
    if (!shipment) {
      throw new NotFoundError(`Shipment with tracking number "${trackingNumber}"`);
    }
    return shipment;
  }

  /**
   * List shipments for an order.
   */
  async getOrderShipments(orderId: string) {
    return this.repo.findShipmentsByOrderId(orderId);
  }

  /**
   * Process inbound courier status webhook (Fez, Kwik, DHL, or Internal dispatch).
   */
  async processCourierWebhook(payload: CourierWebhookPayload) {
    const shipment = await this.repo.findShipmentByTrackingNumber(payload.trackingNumber);
    if (!shipment) {
      throw new NotFoundError(`Shipment with tracking number "${payload.trackingNumber}"`);
    }

    const updated = await this.repo.updateShipmentStatus({
      shipmentId: shipment.id,
      status: payload.status as ShipmentStatus,
      location: payload.location,
      description: payload.description,
      rawPayload: payload.metadata,
      courierName: payload.courierName,
      courierPhone: payload.courierPhone,
      occurredAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    });

    logger.info(
      {
        carrier: payload.carrier,
        trackingNumber: payload.trackingNumber,
        status: payload.status,
        orderId: shipment.orderId,
      },
      "Courier status updated via webhook"
    );

    // Notify customer on milestone transitions
    const shippingAddr = (shipment.order.shippingAddress as Record<string, any>) || {};
    const recipientPhone = shippingAddr.recipientPhone || shipment.order.user?.phone;
    const recipientName = shippingAddr.recipientName || shipment.order.user?.name || "Valued Customer";
    const recipientEmail = shipment.order.user?.email || shipment.order.guestEmail;

    if (payload.status === "OUT_FOR_DELIVERY") {
      if (recipientPhone) {
        SmsService.sendSms(
          recipientPhone,
          `NextDor Update: Your package (${shipment.trackingNumber}) is out for delivery! Our courier ${payload.courierName || "driver"} will contact you shortly.`,
        ).catch((err) => logger.warn({ err: err?.message }, "Failed to dispatch delivery SMS"));
      }
    } else if (payload.status === "DELIVERED") {
      if (recipientPhone) {
        SmsService.sendSms(
          recipientPhone,
          `NextDor Update: Order ${shipment.order.number} has been delivered. Thank you for shopping with NextDor!`,
        ).catch((err) => logger.warn({ err: err?.message }, "Failed to dispatch delivered SMS"));
      }
      if (recipientEmail) {
        dispatchEmailAsync({
          type: "order_status_update",
          params: {
            email: recipientEmail,
            customerName: recipientName,
            orderNumber: shipment.order.number,
            status: "DELIVERED",
            note: "Your package has been successfully delivered. Thank you for shopping with NextDor!",
          },
        });
      }
    }

    return updated;
  }

  // ─── Admin Zone Management ──────────────────────────────────────────────────

  async listZones() {
    return this.repo.listZones();
  }

  async getZone(id: string) {
    const zone = await this.repo.findZoneById(id);
    if (!zone) throw new NotFoundError(`Delivery zone "${id}"`);
    return zone;
  }

  async createZone(input: CreateDeliveryZoneInput) {
    const existing = await this.repo.findZoneByCode(input.code);
    if (existing) {
      throw new BadRequestError(`Delivery zone with code "${input.code}" already exists`);
    }
    return this.repo.createZone(input);
  }

  async updateZone(id: string, input: UpdateDeliveryZoneInput) {
    await this.getZone(id); // Ensure exists
    return this.repo.updateZone(id, input);
  }
}
