const app = require('../src/server');
const connectDB = require('../src/config/db');
const { seedDefaults } = require('../src/utils/seedCategories');

let initialization;

const initialize = async () => {
  if (!initialization) {
    initialization = connectDB().then(async (connected) => {
      if (connected) {
        await seedDefaults();
      }
      return connected;
    });
  }
  return initialization;
};

module.exports = async (req, res) => {
  await initialize();
  return app(req, res);
};
