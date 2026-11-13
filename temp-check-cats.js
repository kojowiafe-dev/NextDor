const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_iRsDwl3j2LmW@ep-empty-wildflower-a592cx45.us-east-2.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function main() {
  const cats = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    },
    orderBy: { name: 'asc' }
  });
  console.log('Categories count:', cats.length);
  console.log(JSON.stringify(cats.map(c => ({ id: c.id, name: c.name, slug: c.slug, productsCount: c._count.products })), null, 2));
}

main()
  .catch(e => console.error('ERR:', e))
  .finally(() => prisma.$disconnect());
