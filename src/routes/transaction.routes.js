const {Router} = require('express');
const  authMiddleware  = require('../middleware/auth.middleware');
const authSystemUserMiddleware = require("../middleware/auth.middleware")
const transactionController = require("../controller/transaction.controller");

const transactionRoutes = Router();



transactionRoutes.post("/",authMiddleware.authMiddleware,transactionController.createTransaction)
   

transactionRoutes.post("/system/initial-funds",authMiddleware.authSystemUserMiddleware,transactionController.createIntialFundsTransaction)




module.exports = transactionRoutes