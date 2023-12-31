import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const DB_OPTIONS = {
            user: '',
            pass: '',
            dbName: process.env.DB_NAME,
            authSource: process.env.AUTH_SOURCE,
        }
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, DB_OPTIONS);
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.error("MongoDB connection error: ", error);
        process.exit(1);
    }
}

export default connectDB;