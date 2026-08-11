const express = require("express");
const { 
  createReservation, 
  listReservations, 
  completeReservation, 
  cancelReservation,
  extendReservation 
} = require("../controllers/reservationController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const validate = require("../middlewares/validate");
const { createReservationSchema } = require("../validations/schemas");

router.use(isAuthenticated);

router.post("/", validate(createReservationSchema), createReservation);
router.get("/", listReservations);
router.patch("/:id/complete", completeReservation);
router.patch("/:id/cancel", cancelReservation);
router.patch("/:id/extend", extendReservation);

module.exports = router;
