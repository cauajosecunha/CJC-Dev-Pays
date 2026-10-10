const broadcaster = require('./broadcaster');
const app = require('./app');

module.exports = {
    ...broadcaster,
    app
};
