import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, pasword } = req.body;

    if (
        [fullName, email, username, pasword].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All field is required")
    }

    const existedUser = User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with this email or username already exists")
    }

    const avtarImageLocalPath = req.files.avatar?.[0]?.path;
    const coverrImageLocalPath = req.files.coverImage?.[0]?.path;

    if (!avtarImageLocalPath) {
        throw new ApiError(400, "Avtar file is required")
    }

    const avtar = await uploadOnCloudinary(avtarImageLocalPath);
    const coverImage = await uploadOnCloudinary(coverrImageLocalPath);

    if (!avtar) {
        throw new ApiError(400, "Avtar file is required")
    }

    const user = await User.create({
        fullName,
        avtar: avtar.url,
        coverImage: coverImage?.url || "",
        email,
        pasword,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }
    console.log("ree", req.body);

    return res.status(400).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
    res.end()
})

export { registerUser };