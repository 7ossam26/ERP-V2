import assert from "node:assert/strict";
import test from "node:test";

import {
  createClientSelectionState,
  isCustomerInformationComplete,
} from "./callCenterCustomerSelection.js";

test("client selection completes the phone number and fills customer details", () => {
  const client = {
    id: 7,
    name: "Ahmed Said",
    phoneNumber: "01012345678",
    address: "Nasr City",
  };

  assert.deepEqual(createClientSelectionState(client), {
    phone: "01012345678",
    selectedClient: client,
    newClientName: "Ahmed Said",
    deliveryAddress: "Nasr City",
    clientResults: [],
  });
});

test("client selection keeps the current typed phone when the stored phone is missing", () => {
  const client = {
    id: 8,
    name: "Walk-in Customer",
    address: null,
  };

  assert.deepEqual(createClientSelectionState(client, "011"), {
    phone: "011",
    selectedClient: client,
    newClientName: "Walk-in Customer",
    deliveryAddress: "",
    clientResults: [],
  });
});

test("customer information is complete only after phone, name, zone, and address are present", () => {
  assert.equal(isCustomerInformationComplete({
    phone: "01012345678",
    name: "Ahmed Said",
    zoneId: "3",
    deliveryAddress: "Nasr City",
  }), true);

  assert.equal(isCustomerInformationComplete({
    phone: "01012345678",
    name: "Ahmed Said",
    zoneId: "",
    deliveryAddress: "Nasr City",
  }), false);

  assert.equal(isCustomerInformationComplete({
    phone: "01012345678",
    name: "Ahmed Said",
    zoneId: "3",
    deliveryAddress: "   ",
  }), false);
});
