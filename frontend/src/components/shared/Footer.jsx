import React from "react";

const Footer = () => {
  return (
    <footer className="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          <a
            href="https://kiko-tech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary hover:text-primary-hover dark:text-primary dark:hover:text-primary-hover transition-colors duration-200 flex items-center gap-1.5">
            <span className="material-icons-round text-base">code</span>
            <span>Developed by</span>
            <span className="font-bold">kiko-tech.com</span>
            <span className="material-icons-round text-xs">open_in_new</span>
          </a>
          <p className="text-sm text-text-light/50 dark:text-text-dark/50">
            © {new Date().getFullYear()} Elghonemy ERP System. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
