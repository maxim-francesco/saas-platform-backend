const express = require("express");
const { createOffer, listOffers } = require("../controllers/offerController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const validate = require("../middlewares/validate");
const { createOfferSchema } = require("../validations/schemas");

router.use(isAuthenticated);

router.post("/", validate(createOfferSchema), createOffer);
router.get("/", listOffers);

module.exports = router;
