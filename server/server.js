const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const MONGO_URI =
  "mongodb+srv://bibUser:xLUBmiK5byDfYAzT@bibcluster-e4tmw.mongodb.net/test?retryWrites=true&w=majority";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

/**
 * Method to filter restaurants out of all the available ones
 * @param  {Object} restaurant
 * @param  {string} distinction
 * @param  {string} cooking
 * @param  {string} query
 * @return {boolean} Should the array include the restaurant
 */
const filterRestaurants = (restaurant, distinction, cooking, query) => {
  const {
    distinction: { type },
    name,
    cookingType
  } = restaurant;
  return (
    type === distinction &&
    (cooking === cookingType || cooking === "Toutes cuisines") &&
    (name.includes(query) || query === "")
  );
};

/**
 * Method to filter restaurants out of all the available ones
 * @param  {Object} restaurant1
 * @param  {Object} restaurant2
 * @param  {string} sorting criteria
 * @return {number} how r1 is positionned relative to r2
 */
const sortRestaurants = (r1, r2, sortingFilter, userLocation) => {
  if (sortingFilter === "Trier par distance" && userLocation) {
    const { lat, long } = userLocation;
    const { latitude: latitude1, longitude: longitude1 } = r1 || {};
    if (latitude1 === null || longitude1 === null) return 1;
    const { latitude: latitude2, longitude: longitude2 } = r2 || {};
    if (latitude2 === null || longitude2 === null) return -1;
    const d1 = Math.sqrt(
      Math.pow(latitude1 - lat, 2) + Math.pow(longitude1 - long, 2)
    );
    const d2 = Math.sqrt(
      Math.pow(latitude2 - lat, 2) + Math.pow(longitude2 - long, 2)
    );
    return d1 > d2 ? 1 : -1;
  }
  if (sortingFilter === "Trier par note décroissante") {
    const { rating: rating1 } = r1;
    const { rating: rating2 } = r2;
    return rating1 > rating2 ? -1 : 1;
  }
  if (sortingFilter === "Trier par note croissante") {
    const { rating: rating1 } = r1;
    const { rating: rating2 } = r2;
    return rating1 > rating2 ? 1 : -1;
  }
  if (sortingFilter === "Trier par prix croissant") {
    const {
      price: { bottom: bottom1, top: top1 }
    } = r1;
    const {
      price: { bottom: bottom2, top: top2 }
    } = r2;
    return (top1 + bottom1) / 2 > (top2 + bottom2) / 2 ? 1 : -1;
  }
  if (sortingFilter === "Trier par prix décroissant") {
    const {
      price: { bottom: bottom1, top: top1 }
    } = r1;
    const {
      price: { bottom: bottom2, top: top2 }
    } = r2;
    return (top1 + bottom1) / 2 > (top2 + bottom2) / 2 ? -1 : 1;
  }
};

/**
 * Method to read restaurants from db
 * @return {Array}: Array of objects restaurants
 */
const getRestaurantsFromDb = filters =>
  new Promise((resolve, reject) => {
    const client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    const { distinctionValue, cookingValue, sortingValue, query } = filters;
    client.connect(err => {
      if (err) return reject(err);
      const collection = client.db("main").collection("restaurants");
      const match = getMatch(distinctionValue, cookingValue, query);
      collection.find(match).toArray((err, data) => {
        if (err) return reject(err);
        resolve(data);
        client.close();
      });
    });
  });

//   mondodb user: bibUser
// password: xLUBmiK5byDfYAzT

const getMatch = (distinctionValue, cookingValue, query) => {
  let match = {
    "distinction.type": distinctionValue
  };
  if (cookingValue !== "Toutes cuisines")
    match = { ...match, cookingType: cookingValue };
  if (query !== "")
    match = {
      ...match,
      name: new RegExp(query, "i")
    };
  return match;
};

app.post("/restaurants", async (req, res) => {
  const {
    distinction: { value: distinctionValue },
    cooking: { value: cookingValue },
    sorting: { value: sortingValue },
    userLocation,
    query
  } = req.body;
  const filters = { distinctionValue, cookingValue, sortingValue, query };
  try {
    const filteredRestaurants = await getRestaurantsFromDb(filters);
    filteredRestaurants.sort((a, b) =>
      sortRestaurants(a, b, sortingValue, userLocation)
    );
    res.json({ error: "", restaurants: filteredRestaurants });
  } catch (e) {
    res.json({ error: e, restaurants: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
