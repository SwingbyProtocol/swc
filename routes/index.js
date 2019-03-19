// Import our Controllers
const relayer = require('../controllers/relayerCtrl')

const routes = [
  {
    method: 'POST',
    url: '/api/relayer',
    handler: relayer.postMetaTx
  }
]

module.exports = routes