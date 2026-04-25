import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";

const PlaceholderModule = ({ title, icon, subtitle }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-2xl text-primary dark:text-accent">
            <Icon name={icon} size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <Icon name="close" className="text-2xl" />
        </button>
      </div>

      <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-400 dark:text-gray-500">
          <Icon name="construction" className="text-5xl" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          تم إنشاء الصفحة
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
          هذه الصفحة جاهزة وتم ربطها بنجاح. سيتم إضافة المحتوى الوظيفي (جداول،
          نماذج، إلخ) في الخطوات القادمة.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors font-bold">
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
};

export default PlaceholderModule;
