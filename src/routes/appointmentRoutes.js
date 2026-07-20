const express = require("express");
const {
  createAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment
} = require("../controllers/appointmentController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const validate = require("../middlewares/validate");
const {
  createAppointmentSchema,
  updateAppointmentSchema
} = require("../validations/schemas");

router.use(isAuthenticated);

router.post("/", validate(createAppointmentSchema), createAppointment);
router.get("/", listAppointments);
router.patch("/:id", validate(updateAppointmentSchema), updateAppointment);
router.delete("/:id", deleteAppointment);

module.exports = router;
