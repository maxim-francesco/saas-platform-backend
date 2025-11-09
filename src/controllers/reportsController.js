// src/controllers/reportsController.js
const prisma = require("../config/prismaClient");

const getProfitabilityReport = async (req, res) => {
  const { businessId } = req.user;
  let { startDate, endDate } = req.query;

  try {
    // Setări default pentru date dacă nu sunt furnizate
    const sDate = startDate ? new Date(startDate) : new Date(0); // 1970
    const eDate = endDate ? new Date(endDate) : new Date(); // Data curentă

    // 1. Găsim toate anunțurile vândute în intervalul de date
    const soldListings = await prisma.listing.findMany({
      where: {
        businessId,
        status: "SOLD",
        soldAt: {
          gte: sDate,
          lte: eDate,
        },
      },
    });

    // 2. Calculăm statisticile
    let totalProfit = 0;
    let totalRevenue = 0;
    let totalPurchaseCost = 0;
    let totalOtherCosts = 0;
    let totalDaysToSell = 0;
    const totalSold = soldListings.length;

    const monthlySales = {};

    soldListings.forEach((listing) => {
      const revenue = listing.sellingPrice || 0;
      const purchaseCost = listing.purchasePrice || 0;
      const otherCosts = listing.otherCosts || 0;
      const profit = revenue - purchaseCost - otherCosts;

      totalRevenue += revenue;
      totalPurchaseCost += purchaseCost;
      totalOtherCosts += otherCosts;
      totalProfit += profit;

      // Calculăm zilele până la vânzare
      if (listing.createdAt && listing.soldAt) {
        const diffTime = Math.abs(
          listing.soldAt.getTime() - listing.createdAt.getTime()
        );
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        totalDaysToSell += diffDays;
      }

      // Agregăm vânzările pe lună pentru grafic
      const monthYear = listing.soldAt.toISOString().substring(0, 7); // "YYYY-MM"
      if (!monthlySales[monthYear]) {
        monthlySales[monthYear] = { profit: 0, count: 0 };
      }
      monthlySales[monthYear].profit += profit;
      monthlySales[monthYear].count += 1;
    });

    // Transformăm agregarea lunară într-un array sortat
    const chartData = Object.keys(monthlySales)
      .map((key) => ({
        name: key,
        Profit: monthlySales[key].profit,
        Listings: monthlySales[key].count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 3. Pregătim răspunsul
    res.status(200).json({
      kpis: {
        totalProfit,
        totalRevenue,
        totalSold,
        avgProfitPerVehicle: totalSold > 0 ? totalProfit / totalSold : 0,
        avgTimeToSell: totalSold > 0 ? totalDaysToSell / totalSold : 0,
        totalPurchaseCost,
        totalOtherCosts,
      },
      chartData,
    });
  } catch (error) {
    console.error("Eroare la generarea raportului:", error);
    res
      .status(500)
      .json({ message: "Eroare la generarea raportului de profitabilitate." });
  }
};

module.exports = { getProfitabilityReport };
