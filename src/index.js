import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
const serverPort = process.env.PORT || 8000;

dotenv.config({
    path: "./env"
});

connectDB()
    .then(() => {
        app.on("error", (err) => {
            console.error("Error: ", err);
            process.exit(1);
        });

        app.listen(serverPort, () => {
            console.log(`Server is running at port: ${serverPort}`)
        });
    })
    .catch((err) => {
        console.error("MongoDB connetection failed !! ", err);
        process.exit(1);
    })

