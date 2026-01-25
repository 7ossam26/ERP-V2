const path = require('path');
const dotenv = require('dotenv');

// Load root .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('--- Verifying Category Uniqueness ---');
    const catName = "TestUniqCat_" + Date.now();

    // 1. Create first category
    try {
        await prisma.category.create({ data: { name: catName } });
        console.log('1. Created category:', catName);
    } catch (e) {
        console.error('Failed to create initial category:', e);
        return;
    }

    // 2. Try duplicate
    try {
        await prisma.category.create({ data: { name: catName } });
        console.error('FAIL: Duplicate category creation succeeded! Constraint not active.');
    } catch (e) {
        if (e.code === 'P2002') {
            console.log('PASS: Duplicate category creation failed with P2002 as expected.');
        } else {
            console.error('FAIL: Duplicate category failed but not with P2002. Error:', e.code);
        }
    }

    // Cleanup category
    // await prisma.category.deleteMany({ where: { name: catName } });

    console.log('\n--- Verifying Item Uniqueness ---');
    const itemName = "TestUniqItem_" + Date.now();

    // 1. Create first item
    try {
        await prisma.item.create({
            data: {
                name: itemName,
                price: 100,
                unit: "piece"
            }
        });
        console.log('1. Created item:', itemName);
    } catch (e) {
        console.error('Failed to create initial item:', e);
        return;
    }

    // 2. Try duplicate
    try {
        await prisma.item.create({
            data: {
                name: itemName,
                price: 200,
                unit: "piece"
            }
        });
        console.error('FAIL: Duplicate item creation succeeded! Constraint not active.');
    } catch (e) {
        if (e.code === 'P2002') {
            console.log('PASS: Duplicate item creation failed with P2002 as expected.');
        } else {
            console.error('FAIL: Duplicate item failed but not with P2002. Error:', e.code, e);
        }
    }

    // Cleanup item
    // await prisma.item.deleteMany({ where: { name: itemName } });
}

verify()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
