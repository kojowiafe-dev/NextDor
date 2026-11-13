const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_iRsDwl3j2LmW@ep-empty-wildflower-a592cx45.us-east-2.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function check() {
  const prods = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      categories: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });
  console.log('Total products:', prods.length);
  for (const p of prods) {
    const catNames = p.categories.map(c => c.name).join(', ') || 'NONE';
    console.log(`- [${catNames}] ${p.name}`);
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
