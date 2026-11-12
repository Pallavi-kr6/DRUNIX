'use strict';
const { makeLedger } = require('../server/index');
const { seedParticipants } = require('../server/seed');
seedParticipants(makeLedger(), console.log).then(() => process.exit(0), (e) => { console.error('seed failed:', e.code || '', e.message); process.exit(1); });
