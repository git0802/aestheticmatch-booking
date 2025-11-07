SELECT 
  id, 
  firstName, 
  lastName,
  LENGTH(firstName) as firstName_length,
  LENGTH(lastName) as lastName_length,
  CONCAT('[', firstName, ']') as firstName_with_brackets,
  CONCAT('[', lastName, ']') as lastName_with_brackets
FROM Patient 
WHERE email = 'MelvinERodriguez@dayrep.com';
