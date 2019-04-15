'use strict';

const relayerCtrl = require('../controllers/relayerCtrl')
const wshCtrl = require('../controllers/wshCtrl')

const routes = [{
        method: 'GET',
        url: '/wshLists',
        handler: wshCtrl.getWshLists
    }, {
        method: 'GET',
        url: '/wshLists/:wsh',
        handler: wshCtrl.getWshSingle
    }, {
        method: 'POST',
        url: '/metaTxRelay/:gasToken',
        handler: relayerCtrl.postMetaTx
    },
    {
        method: 'GET',
        url: '/metaTxRelay/:gasToken',
        handler: relayerCtrl.getMetaTx
    }
]

module.exports = function (fastify, opts, next) {
    routes.forEach((route, index) => {
        fastify.route(route)
    })
    next()
}