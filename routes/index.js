'use strict';

const relayer = require('../controllers/relayerCtrl')
const keep = require('../controllers/keepCtrl')


const routes = [{
        method: 'POST',
        url: '/metaTxRelay/:tokenAddress',
        handler: relayer.postMetaTx
    },
    {
        method: 'GET',
        url: '/metaTxRelay/:tokenAddress',
        handler: relayer.getMetaTx
    }
]

module.exports = function (fastify, opts, next) {
    routes.forEach((route, index) => {
        fastify.route(route)
    })
    next()
}