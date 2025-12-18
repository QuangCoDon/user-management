require("dotenv").config({ quiet: true });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json()); 

mongoose
  .connect(
    process.env.MONGO_URI
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên là bắt buộc"],
      trim: true, 
    },
    age: {
      type: Number,
      min: [0, "Tuổi không được âm"], 
      validate: {
        validator: Number.isInteger,
        message: "Tuổi phải là số nguyên",
      },
    },
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true, 
      trim: true,
      lowercase: true, 
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"], // Regex check format email
    },
    address: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

// GET /api/users 
app.get("/api/users", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || "";

    // Chặn giá trị không hợp lệ
    if (page < 1) page = 1;
    if (limit < 1) limit = 5;
    if (limit > 50) limit = 50; 

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    // Chạy song song 2 truy vấn
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).select("-__v"), 
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      page,
      limit,
      total,
      totalPages,
      data: users,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi Server: " + err.message });
  }
});

// POST /api/users
app.post("/api/users", async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    
    res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser,
    });
  } catch (err) {
    // Xử lý lỗi trùng Email
    if (err.code === 11000) {
      return res.status(400).json({ error: "Email này đã tồn tại!" });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/users/:id 
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID người dùng không hợp lệ" });
    }

    // Chỉ lấy những field có gửi lên và có giá trị, tránh ghi đè null/undefined
    const updateData = {};
    const allowedFields = ["name", "age", "email", "address"];
    
    allowedFields.forEach((field) => {
      // Chỉ add vào updateData nếu req.body có field đó và giá trị không rỗng
      if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== "") {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Không có dữ liệu nào để cập nhật" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Cập nhật thành công",
      data: updatedUser,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Email mới bị trùng với người khác!" });
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID người dùng không hợp lệ" });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    
    if (!deletedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng để xóa" });
    }

    res.json({ message: "Xóa người dùng thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});