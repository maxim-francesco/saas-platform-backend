// src/controllers/attributeGroupController.js
const prisma = require("../config/prismaClient");

// --- Toate funcțiile sunt declarate ca 'const' ---

const createGroup = async (req, res) => {
  const { name } = req.body;
  const { businessId } = req.user;
  if (!name)
    return res.status(400).json({ message: "Numele este obligatoriu." });
  try {
    const group = await prisma.attributeGroup.create({
      data: { name, businessId },
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: "Eroare la crearea grupului." });
  }
};

const getGroups = async (req, res) => {
  const { businessId } = req.user;
  try {
    const groups = await prisma.attributeGroup.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    });
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea grupurilor." });
  }
};

const updateGroup = async (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body;
  const { businessId } = req.user;
  try {
    const updatedGroup = await prisma.attributeGroup.updateMany({
      where: { id: groupId, businessId },
      data: { name },
    });
    if (updatedGroup.count === 0)
      return res.status(404).json({ message: "Grup negăsit." });
    res.status(200).json({ message: "Grup actualizat." });
  } catch (error) {
    res.status(500).json({ message: "Eroare la actualizarea grupului." });
  }
};

const deleteGroup = async (req, res) => {
  const { groupId } = req.params;
  const { businessId } = req.user;
  try {
    const result = await prisma.attributeGroup.deleteMany({
      where: { id: groupId, businessId },
    });
    if (result.count === 0)
      return res.status(404).json({ message: "Grup negăsit." });
    res.status(200).json({ message: "Grup șters." });
  } catch (error) {
    res.status(500).json({ message: "Eroare la ștergerea grupului." });
  }
};

const assignAttributesToGroup = async (req, res) => {
  const { groupId } = req.params;
  const { attributeIds } = req.body;
  const { businessId } = req.user;

  if (!Array.isArray(attributeIds)) {
    return res
      .status(400)
      .json({ message: "Este necesar un array de ID-uri de atribute." });
  }

  try {
    const group = await prisma.attributeGroup.findFirst({
      where: { id: groupId, businessId },
    });
    if (!group) {
      return res.status(404).json({ message: "Grupul nu a fost găsit." });
    }

    await prisma.attribute.updateMany({
      where: {
        id: { in: attributeIds },
        category: { businessId }, // Securitate adăugată
      },
      data: {
        attributeGroupId: groupId,
      },
    });

    res.status(200).json({
      message: `${attributeIds.length} atribute au fost asignate grupului.`,
    });
  } catch (error) {
    res.status(500).json({ message: "Eroare la asignarea atributelor." });
  }
};

// --- Un singur bloc de export la final ---
module.exports = {
  createGroup,
  getGroups,
  updateGroup,
  deleteGroup,
  assignAttributesToGroup,
};
