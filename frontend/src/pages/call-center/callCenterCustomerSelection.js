export const createClientSelectionState = (client, fallbackPhone = "") => ({
  phone: client?.phoneNumber || fallbackPhone,
  selectedClient: client,
  newClientName: client?.name || "",
  deliveryAddress: client?.address || "",
  clientResults: [],
});

const hasValue = (value) => String(value || "").trim().length > 0;

export const isCustomerInformationComplete = ({
  phone,
  name,
  zoneId,
  deliveryAddress,
}) =>
  hasValue(phone) &&
  hasValue(name) &&
  hasValue(zoneId) &&
  hasValue(deliveryAddress);
