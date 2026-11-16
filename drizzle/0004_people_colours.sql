-- People get colours of their own. The old set reused the room colours (fjord, ochre,
-- spruce) and the warning colour (barn), so a dot beside a name could read as a room.
-- Each old colour maps to the new one in the same position.
UPDATE "membership" SET "colour" = CASE "colour"
  WHEN '#A6402F' THEN '#7D4A78'
  WHEN '#2E5270' THEN '#2C7A76'
  WHEN '#D2A24C' THEN '#A8502F'
  WHEN '#476B52' THEN '#4A4E99'
  WHEN '#7A5C8E' THEN '#6E7332'
  WHEN '#3F7F86' THEN '#B04F6C'
  WHEN '#B5683C' THEN '#7A5440'
  WHEN '#6B7385' THEN '#55657A'
  ELSE "colour"
END;
