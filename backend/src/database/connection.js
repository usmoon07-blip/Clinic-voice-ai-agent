'use strict';
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

async function connect() {
  await prisma.$connect();
  logger.info('Ma\'lumotlar bazasiga ulandi');
}

async function disconnect() {
  await prisma.$disconnect();
}

module.exports = { prisma, connect, disconnect };
