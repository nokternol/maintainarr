-- The single value a parameterized actuator task declares (a provider-native id
-- as a string — quality profile, tag, collection). Null for parameterless tasks.
ALTER TABLE `automations` ADD COLUMN `taskParameter` TEXT;
