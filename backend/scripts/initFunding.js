const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Funding = require('../models/Funding');

const fundingData = [
  {
    title: "iDEA Project Grant",
    provider: "ICT Division, Bangladesh",
    amount: "10 Lakh BDT",
    deadline: new Date("2026-12-31"),
    eligibility: "Student-led startups and innovators.",
    category: "Grant",
    applyLink: "https://idea.gov.bd/",
    pastWinners: "Over 400+ startups funded."
  },
  {
    title: "Startup Bangladesh Limited",
    provider: "Government of Bangladesh",
    amount: "Seed/Equity up to 5 Crore BDT",
    deadline: new Date("2026-08-15"),
    eligibility: "Registered Bangladeshi startups with high growth potential.",
    category: "Accelerator",
    applyLink: "https://www.startupbangladesh.vc/",
    pastWinners: "Cramstack, Alice Labs, Pathao."
  },
  {
    title: "Hult Prize BracU",
    provider: "Hult Prize Foundation",
    amount: "$1,000,000 Global Prize",
    deadline: new Date("2026-11-20"),
    eligibility: "Student teams solving social challenges.",
    category: "Competition",
    applyLink: "https://www.hultprize.org/",
    pastWinners: "Several BracU teams advanced to regionals."
  },
  {
    title: "Tiger IT Foundation Grant",
    provider: "Tiger IT Foundation",
    amount: "Tech Infrastructure & Grants",
    deadline: new Date("2026-10-30"),
    eligibility: "Technology-driven solutions for social impact.",
    category: "Grant",
    applyLink: "http://tigeritfoundation.org/",
    pastWinners: "Top tech innovators across Bangladesh."
  }
];

const seedFunding = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB for seeding...");

    // Clear existing funding data
    await Funding.deleteMany();
    console.log("Existing funding data cleared.");

    // Insert new data
    await Funding.insertMany(fundingData);
    console.log("Funding data successfully seeded.");

    mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
};

seedFunding();
