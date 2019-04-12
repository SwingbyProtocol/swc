'use strict';

const relayer = require('../controllers/relayerCtrl')


const routes = [{
        method: 'POST',
        url: '/metaTxRelay/:gasToken',
        handler: relayer.postMetaTx
    },
    {
        method: 'GET',
        url: '/metaTxRelay/:gasToken',
        handler: relayer.getMetaTx
    }
]

module.exports = function (fastify, opts, next) {
    routes.forEach((route, index) => {
        fastify.route(route)
    })
    next()
}