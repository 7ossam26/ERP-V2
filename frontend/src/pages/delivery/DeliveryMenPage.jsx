import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";
import axios from "axios";
import AuthService from "../../services/authService";
import toast from "react-hot-toast";

const DeliveryMenPage = () => {
  const user = AuthService.getCurrentUser();
  const [deliveryMen, setDeliveryMen] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentDeliveryMan, setCurrentDeliveryMan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    nationalId: "",
    vehicleType: "",
    isActive: true,
  });

  const fetchDeliveryMen = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/delivery-men`,
        {
          params: { branchId: user.branchId },
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );
      setDeliveryMen(response.data);
    } catch (error) {
      console.error("Error fetching delivery men:", error);
      toast.error("فشل في تحميل بيانات الطيارين");
    }
  };

  useEffect(() => {
    if (user) {
      fetchDeliveryMen();
    }
  }, [user]);

  const handleOpen = (deliveryMan = null) => {
    if (deliveryMan) {
      setCurrentDeliveryMan(deliveryMan);
      setFormData({
        name: deliveryMan.name,
        phone: deliveryMan.phone,
        nationalId: deliveryMan.nationalId || "",
        vehicleType: deliveryMan.vehicleType || "",
        isActive: deliveryMan.isActive,
      });
    } else {
      setCurrentDeliveryMan(null);
      setFormData({
        name: "",
        phone: "",
        nationalId: "",
        vehicleType: "",
        isActive: true,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentDeliveryMan(null);
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.phone) {
        toast.error("يرجى ملء الحقول المطلوبة");
        return;
      }

      const payload = {
        ...formData,
        branchId: user.branchId,
      };

      if (currentDeliveryMan) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/api/delivery-men/${currentDeliveryMan.id}`,
          payload,
          { headers: { Authorization: `Bearer ${user.token}` } },
        );
        toast.success("تم تحديث البيانات بنجاح");
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/delivery-men`,
          payload,
          { headers: { Authorization: `Bearer ${user.token}` } },
        );
        toast.success("تم إضافة الطيار بنجاح");
      }
      fetchDeliveryMen();
      handleClose();
    } catch (error) {
      console.error("Error saving delivery man:", error);
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("هل أنت متأكد من حذف هذا الطيار؟")) {
      try {
        await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/delivery-men/${id}`,
          {
            headers: { Authorization: `Bearer ${user.token}` },
          },
        );
        toast.success("تم حذف الطيار بنجاح");
        fetchDeliveryMen();
      } catch (error) {
        console.error("Error deleting delivery man:", error);
        toast.error("فشل في حذف الطيار");
      }
    }
  };

  return (
    <Box p={3}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}>
        <Typography variant="h4" component="h1">
          إدارة الطيارين
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpen()}>
          إضافة طيار جديد
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>الاسم</TableCell>
              <TableCell>رقم الهاتف</TableCell>
              <TableCell>نوع المركبة</TableCell>
              <TableCell>الحالة</TableCell>
              <TableCell>إجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deliveryMen.map((man) => (
              <TableRow key={man.id}>
                <TableCell>{man.name}</TableCell>
                <TableCell>{man.phone}</TableCell>
                <TableCell>{man.vehicleType || "-"}</TableCell>
                <TableCell>{man.isActive ? "نشط" : "غير نشط"}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(man)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(man.id)}
                    color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {deliveryMen.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  لا يوجد بيانات
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {currentDeliveryMan ? "تعديل بيانات الطيار" : "إضافة طيار جديد"}
        </DialogTitle>
        <DialogContent>
          <Box
            display="flex"
            flexDirection="column"
            gap={2}
            mt={1}
            minWidth="400px">
            <TextField
              label="الاسم"
              name="name"
              value={formData.name}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              label="رقم الهاتف"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              label="رقم الهوية (اختياري)"
              name="nationalId"
              value={formData.nationalId}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              label="نوع المركبة (اختياري)"
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              fullWidth
              placeholder="مثال: دراجة نارية، سيارة"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={handleChange}
                  name="isActive"
                  color="primary"
                />
              }
              label="نشط"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            إلغاء
          </Button>
          <Button onClick={handleSubmit} color="primary" variant="contained">
            حفظ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeliveryMenPage;
