/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
let mongodb = require('mongodb')
let mongoose = require('mongoose')
const fetch = require('node-fetch');
require('dotenv').config();

module.exports = function (app) {
  
  let uri = process.env.DB;
  mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  
  let stockSchema = new mongoose.Schema({
    symbol: {type: String, required: true},
    likes: {type: Number, default: 0},
    ips: [String]
  })
  
  let Stock = mongoose.model('stock', stockSchema)
  
  app.route('/api/stock-prices')
    .get(function (req, res){
    
      let responseObject = {}
      responseObject['stockData'] = {}

      // Variable to determine number of stocks
      let twoStocks = false
      /* Output Response */
      let outputResponse = () => {
          return res.json(responseObject)
      }
      

      /* Find/Update Stock Document */
      let findOrUpdateStock = (stockName, documentUpdate, nextStep) => {
        Stock.findOneAndUpdate({ symbol: stockName }, documentUpdate, { new: true, upsert: true })
          .then(stockDocument => {
            if (stockDocument) {
              if (twoStocks === false) {
                return nextStep(stockDocument, processOneStock);
              } else {
                return nextStep(stockDocument, processTwoStocks);
              }
            }
          })
          .catch(error => {
            console.log(error);
          });
      };
      

      /* Like Stock */
      let likeStock = (stockName, nextStep) => {
        Stock.findOne({ symbol: stockName })
          .exec()
          .then(stockDocument => {
            if (stockDocument && stockDocument['ips'] && stockDocument['ips'].includes(req.ip)) {
              return res.json('Error: Only 1 Like per IP Allowed');
            } else {
              let documentUpdate = { $inc: { likes: 1 }, $push: { ips: req.ip } };
              nextStep(stockName, documentUpdate, getPrice);
            }
          })
          .catch(error => {
            console.log(error);
          });
      };
      
      /* Get Price */
      let getPrice = (stockDocument, nextStep) => {
        let requestUrl = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockDocument['symbol']}/quote`;
      
        fetch(requestUrl)
          .then(response => response.json())
          .then(apiResponse => {
            stockDocument['price'] = Number(apiResponse['latestPrice']).toFixed(2);
            nextStep(stockDocument, outputResponse);
          })
          .catch(error => {
            console.log(error);
          });
      };
      

      /* Build Response for 1 Stock */
let processOneStock = (stockDocument, nextStep) => {
  let stockData = {
    stock: stockDocument['symbol'],
    price: Number(stockDocument['price']) ,
    likes: Number(stockDocument['likes'])
  };
  console.log('processOneStock - stockData:', stockData);
 
  return res.json({ stockData });
};
let stocks = []        
let processTwoStocks = (stockDocument, nextStep) => {
  let newStock = {}
   newStock.stock = stockDocument['symbol'];
    newStock.price= Number(stockDocument['price']) || 0;
    newStock['likes'] = stockDocument['likes']

  

  stocks.push(newStock);

  if (stocks.length === 2) {
    stocks[0]['rel_likes'] = stocks[0]['likes'] - stocks[1]['likes']
    stocks[1]['rel_likes'] = stocks[1]['likes'] - stocks[0]['likes']
    responseObject['stockData'] = stocks
    
    let stockData = stocks.map(stock => ({
      stock: stock.stock,
      price: stock.price,
      rel_likes: stock.rel_likes
    }));
    console.log( stockData);
  
    return res.json({ stockData });
    nextStep()

  }
}

      
      

   /* Process Input*/  
   if(typeof (req.query.stock) === 'string'){
    /* One Stock */
    let stockName = req.query.stock
    
    let documentUpdate = {}
    if(req.query.like && req.query.like === 'true'){
        likeStock(stockName, findOrUpdateStock)
    }else{
        findOrUpdateStock(stockName, documentUpdate, getPrice)
    }


  } else if (Array.isArray(req.query.stock)){
    twoStocks = true
    
    /* Stock 1 */
    let stockName = req.query.stock[0]
    if(req.query.like && req.query.like === 'true'){
        likeStock(stockName, findOrUpdateStock)
    }else{
        let documentUpdate = {}
        findOrUpdateStock(stockName, documentUpdate, getPrice)
    }

    /* Stock 2 */
    stockName = req.query.stock[1]
    if(req.query.like && req.query.like === 'true'){
        likeStock(stockName, findOrUpdateStock)
    }else{
        let documentUpdate = {}
        findOrUpdateStock(stockName, documentUpdate, getPrice)
    }


  }
});

};