import React from "react";

const PrintableReport = ({ title, subtitle, data, columns }) => {
  const today = new Date();

  return (
    <div
      id="printable-report"
      style={{
        display: "none",
        backgroundColor: "white",
        padding: "20px",
        fontFamily: "Cairo, sans-serif",
      }}
      className="print:block">
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "2px solid #1f2937",
        }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}>
          <div style={{ textAlign: "right" }}>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "4px",
                color: "#000",
              }}>
              {title}
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
              }}>
              {subtitle}
            </p>
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0" }}>
              التاريخ: {today.toLocaleDateString("ar-EG")}
            </p>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0" }}>
              الوقت:{" "}
              {today.toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #000",
        }}>
        <thead>
          <tr style={{ backgroundColor: "#1f2937" }}>
            {columns.map((col, index) => (
              <th
                key={index}
                style={{
                  border: "1px solid black",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  textAlign: "center",
                  color: "white",
                }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((item, rowIndex) => (
              <tr
                key={item.id || rowIndex}
                style={{
                  backgroundColor: rowIndex % 2 === 0 ? "#f9fafb" : "white",
                }}>
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    style={{
                      border: "1px solid #d1d5db",
                      padding: "6px 10px",
                      fontSize: "11px",
                      textAlign: "center",
                      color: "#000",
                    }}>
                    {col.render
                      ? typeof col.render(item) === "object"
                        ? JSON.stringify(col.render(item))
                        : col.render(item)
                      : item[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  border: "1px solid #d1d5db",
                  padding: "12px",
                  textAlign: "center",
                  color: "#6b7280",
                }}>
                لا توجد بيانات
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div
        style={{
          marginTop: "24px",
          paddingTop: "16px",
          borderTop: "1px solid #d1d5db",
          textAlign: "center",
        }}>
        <p
          style={{
            fontSize: "11px",
            color: "#9ca3af",
          }}>
          Ramex Store ERP - تقرير مطبوع
        </p>
      </div>
    </div>
  );
};

export default PrintableReport;
