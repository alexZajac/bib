import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema({
  restaurant: {
    type: String,
    unique: true,
  },
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
export default Restaurant;