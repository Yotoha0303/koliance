import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KolianceModule", (m) => {
  const koliance = m.contract("Koliance");

  return { koliance };
});
