import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const genrateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.genrateAccessToken();
        const refreshToken = user.genrateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while creating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All field is required")
    }

    const existedUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existedUser) {
        throw new ApiError(409, "User with this email or username already exists")
    }

    const avatarImageLocalPath = req.files?.avatar?.[0]?.path;
    const coverrImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarImageLocalPath) {
        throw new ApiError(400, "avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarImageLocalPath);
    const coverImage = await uploadOnCloudinary(coverrImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required")
    }
    if (password === "") {
        throw new ApiError(400, "Password field is required")
    }
    const user = await User.findOne({ $or: [{ username }, { email }] });
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credential")
    }

    const { accessToken, refreshToken } = await genrateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out Successfully"))
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken || "";
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, newRefreshToken } = await genrateAccessAndRefreshToken(user?._id);

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed")
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isOldPasswordCorrect) {
        throw new ApiError(400, "old password is not correct")
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"))
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All field is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { fullName, email }
        },
        { new: true }
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Account Details Updated successfully"))
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalpath = req.file?.path || "";
    if (!avatarLocalpath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalpath);

    if (!avatar) {
        throw new ApiError(500, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { avatar: avatar.url } },
        { new: true }
    );

    return res.status(200).json(new ApiResponse(200, user, "User Avatar updated successfully"))
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalpath = req.file?.path || "";
    if (!coverImageLocalpath) {
        throw new ApiError(400, "Cover Image file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalpath);

    if (!coverImage) {
        throw new ApiError(500, "Error while uploading cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "User Cover Image updated successfully"))
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    if (!username?.trim()) {
        throw new ApiError(400, "User not found")
    }

    const channel = await User.aggregate([
        {
            $match: { username: username?.toLowerCase() }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }

    console.log("channel==", channel)
    return res.
        status(200).
        json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(req.user._id) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "watchHistory",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"))
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};