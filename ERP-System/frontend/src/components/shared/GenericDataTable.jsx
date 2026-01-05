import React from "react";

const GenericDataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  loading,
  emptyMessage = "لا توجد بيانات مضافة بعد.",
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center border-collapse">
        <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                {col.header}
              </th>
            ))}
            {/* Actions Header - Render only if onEdit or onDelete provided */}
            {(onEdit || onDelete) && (
              <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                إجراءات
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading ? (
            <tr>
              <td colSpan={columns.length + 1} className="text-center p-10">
                جاري التحميل...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="text-center p-10 text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-default">
                {columns.map((col, index) => (
                  <td
                    key={index}
                    className="px-6 py-4 whitespace-nowrap text-center">
                    {col.render ? (
                      col.render(item)
                    ) : (
                      <div className="text-sm text-gray-900 dark:text-gray-200">
                        {item[col.accessor]}
                      </div>
                    )}
                  </td>
                ))}
                {/* Actions Cell - Render only if onEdit or onDelete provided */}
                {(onEdit || onDelete) && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(item)}
                        className="text-blue-500 hover:text-blue-700 ml-2 transition-colors">
                        <span className="material-icons-round">edit</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors">
                        <span className="material-icons-round">delete</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GenericDataTable;
