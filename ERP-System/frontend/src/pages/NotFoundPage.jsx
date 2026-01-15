import React from "react";
import { useNavigate } from "react-router-dom";
import "./NotFoundPage.css";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        {/* 404 Error Code */}
        <div className="error-code">
          <span>404</span>
        </div>

        {/* Error Message */}
        <h1 className="error-title">الصفحة غير موجودة</h1>
        <p className="error-description">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى موقع آخر
        </p>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="btn-primary"
            onClick={() => navigate("/dashboard")}>
            الصفحة الرئيسية
          </button>
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            العودة للخلف
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
