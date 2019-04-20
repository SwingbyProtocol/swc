'use strict';

const ethTx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const bs58 = require('bs58')
const BN = ethUtil.BN
const config = require('config')
const btc2eth1 = require('../build/contracts/Btc2eth1.json')
const api = require("../resolvers").api
const account = require('../resolvers').account()
const ecies = require("eth-ecies");
const sha256 = require('sha256')

let btc2eth1Instance
let lastIPFSHash
let nowNonce = 0
let txs = {}
let data = {}

console.log('daemon start')

setTimeout(async () => {
    try {
        await fetchKeep()
        await checkWshes()
        await updateKeep()
        eventHandler()
    } catch (err) {
        console.log(err)
    }
}, 5000)


const injectData = () => {
    data.owner = {
        address: account.address,
        pubkey: '0x' + ethUtil.privateToPublic(account.privkey).toString('hex')
    }
    data.witnesses = {}
    data.wshSecrets = {}
    data.archives = {}
}
const fetchKeep = async () => {
    try {
        const web3 = await api.getWeb3()
        if (!btc2eth1Instance) {
            btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
        }
        const getStoredData = await btc2eth1Instance.methods.getKeep(account.address).call()

        if (emptyAddress(getStoredData.toString())) {
            console.log('error data is not stored')
            injectData()
        } else {
            const ipfsHash = toIPFSHash(getStoredData.toString())
            const result = await ipfsCall(ipfsHash)
            if (!result.owner) {
                console.log('error data is not exist will be init')
                injectData()

            } else {
                data = result
            }
            //injectData()
        }
    } catch (err) {
        console.log(err)
    }
}

const checkWshes = async () => {
    try {
        const web3 = await api.getWeb3()
        if (!btc2eth1Instance) {
            btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
        }
        if (!data.owner) {
            fetchKeep()
        }
        const injects = data.wshSecrets
        const keysOfInejects = Object.keys(injects)
        const secret = web3.utils.randomHex(32)
        if (keysOfInejects.length <= 10) {
            const wsh = '0x' + sha256(Buffer.from(secret.slice(2), 'hex'))
            console.log(secret, wsh)
            const witnesses = data.witnesses
            const keysOfWitnesses = Object.keys(witnesses)
            if (keysOfWitnesses.length >= 3) {
                data.wshSecrets[wsh] = []
                keysOfWitnesses.forEach((address) => {
                    const witness = witnesses[address]
                    const userPublicKey = Buffer.from(witness.pubkey.slice(2), 'hex');
                    const bufferData = Buffer.from(secret);
                    const encryptedData = ecies.encrypt(userPublicKey, bufferData);
                    data.wshSecrets[wsh].push({
                        address: witness.address,
                        encrypted: encryptedData.toString('base64')
                    })
                })
                const func = btc2eth1Instance.methods.addWsh(wsh)
                await sendTx('addWsh', func.encodeABI())
            }
            //console.log(data)
        } else {
            console.log('reach max size of secrets')
        }
    } catch (err) {
        console.log(err)
    }
    setTimeout(() => {
        checkWshes()
    }, 14400)
}

const updateKeep = async () => {
    try {
        const web3 = await api.getWeb3()
        if (!btc2eth1Instance) {
            btc2eth1Instance = new web3.eth.Contract(btc2eth1.abi, config.eth.btc2eth1.address)
        }
        if (!data.owner) {
            fetchKeep()
        }
        const ipfsHash = await storeIPFS()
        const func = btc2eth1Instance.methods.keep(ipfsHash)
        await sendTx('keep', func.encodeABI())
    } catch (err) {
        console.log(err)
    }
    setTimeout(() => {
        updateKeep()
    }, 14400)
}

const storeIPFS = async () => {
    try {
        const doc = JSON.stringify(data, null, 4)
        console.log(data)
        console.log('enclave operater...', account.address)
        const ipfs = await api.getIPFS()
        let cid = await ipfs.add(Buffer.from(doc));
        let bytes32 = fromIPFSHash(cid[0].hash)
        await ipfs.pin.add(cid[0].hash)
        console.log('IPFS pinned cid:', cid[0].hash)
        if (lastIPFSHash) {
            setTimeout(async () => {
                await ipfs.pin.rm(lastIPFSHash)
                console.log('pin rm', lastIPFSHash)
            }, 4000)
        }
        lastIPFSHash = cid[0].hash
        return '0x' + bytes32.toString('hex')

    } catch (err) {
        console.log(err)
    }
}

const attachWitnessToData = async (own, ipf) => {
    try {
        const ipfsPath = toIPFSHash(ipf)
        const parsed = await ipfsCall(ipfsPath)
        if (!data.owner) {
            console.log('error data is not exist')
            return false
        }
        if (data.witnesses[own]) {
            console.log('witness already attached')
            return false
        }
        data.witnesses[own] = parsed.owner
        console.log('Add witness to keep...', own)
    } catch (err) {
        console.log(err)
    }
}

const sendTx = async (method, data) => {
    const web3 = await api.getWeb3()
    const nonce = await web3.eth.getTransactionCount(account.address)
    console.log('nowNonce', nowNonce.toString(), 'nonce', nonce.toString())

    if (new BN(nonce.toString()).gt(nowNonce)) {
        nowNonce = new BN(nonce.toString())
    }
    console.log('nowNonce', nowNonce.toString(), 'nonce', nonce.toString())

    const txParams = {
        nonce: '0x' + nowNonce.toArrayLike(Buffer, 'be', 32).toString('hex'),
        gasPrice: 2000000000,
        gasLimit: 300000,
        from: account.address,
        to: btc2eth1Instance.address,
        data: data,
        chainId: process.env.NODE_ENV === 'mainnet' ? 0 : 5
    };
    nowNonce = nowNonce.add(new BN("1"))
    const tx = new ethTx(txParams);
    tx.sign(account.privkey);

    const serializedTx = '0x' + tx.serialize().toString('hex')

    if (txs[serializedTx]) {
        console.log("tx is already sent")
        return false
    }

    const txHash = await handleSend(web3, serializedTx)
    console.log('sending tx...', method, txHash)
}


const eventHandler = async () => {
    try {
        if (!btc2eth1Instance) {
            return false
        }
        btc2eth1Instance.events.KeepEvent()
            .on('data', (event) => {
                //console.log(event); // same results as the optional callback above
                updateDataByKeepEvent(event)
            })
            .on('changed', (event) => {
                console.log(event.returnValues.ipf, 'change'); /// remove event from local database
            })
            .on('error', (err) => {
                console.log(err)
            })

        btc2eth1Instance.events.EntangleOneEvent()
            .on('data', (event) => {
                //console.log(event); // same results as the optional callback above
                //updateDataByKeepEvent(ipfs, event)
                let wsh = event.returnValues.wsh
                if (data.wshSecrets[wsh]) {
                    data.archives[wsh] = data.wshSecrets[wsh]
                    delete data.wshSecrets[wsh]
                    console.log("archived wsh:", wsh)
                }

            })
            .on('changed', (event) => {
                console.log(event.returnValues.ipf, 'change'); /// remove event from local database
            })
            .on('error', (err) => {
                console.log(err)
            })

        btc2eth1Instance.events.EntangleTwoEvent()
            .on('data', (event) => {
                //console.log(event); // same results as the optional callback above
                //updateDataByKeepEvent(ipfs, event)
                console.log('EntangleTwoEvent')
            })
            .on('changed', (event) => {
                console.log(event.returnValues.ipf, 'change'); /// remove event from local database
            })
            .on('error', (err) => {
                console.log(err)
            })
    } catch (err) {
        console.log(err)
    }
}

const updateDataByKeepEvent = (event) => {
    attachWitnessToData(event.returnValues.own, event.returnValues.ipf)
}


const handleSend = (web3, serializedTx) => {
    return new Promise((resolve, reject) => {
        web3.eth.sendSignedTransaction(serializedTx)
            .on('transactionHash', (txHash) => {
                resolve(txHash)
            })
            .on('error', function (err) {
                reject(err)
            })
            .on('confirmation', function (confirmationNumber, receipt) {
                if (confirmationNumber <= 5)
                    console.log(confirmationNumber, receipt.transactionHash)
            })
    })
}

const ipfsCall = (ipfsHash) => {
    return new Promise(async (resolve, reject) => {
        const ipfs = await api.getIPFS()
        ipfs.cat(ipfsHash).then((retunData) => {
            const result = JSON.parse(retunData.toString())
            resolve(result)
        }).catch((err) => {
            reject(err)
        })
    })
}


const fromIPFSHash = hash => {
    const bytes = bs58.decode(hash);
    const multiHashId = 2;
    // remove the multihash hash id
    return bytes.slice(multiHashId, bytes.length);
};
const toIPFSHash = str => {
    // remove leading 0x
    const remove0x = str.slice(2, str.length);
    // add back the multihash id
    const bytes = Buffer.from(`1220${remove0x}`, "hex");
    const hash = bs58.encode(bytes);
    return hash;
};

const emptyAddress = address => {
    return /^0x0+$/.test(address)
}