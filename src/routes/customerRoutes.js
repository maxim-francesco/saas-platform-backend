const express = require("express");
const {
  listCustomers,
  getCustomer
} = require("../controllers/customerController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);

router.get("/", listCustomers);
router.get("/:phone", getCustomer);

module.exports = router;
