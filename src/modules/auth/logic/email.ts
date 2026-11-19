// Auth module rules: only school email addresses may sign up (the database checks this too, migration 0006).
export const isSchoolEmail = (email: string) => /^[^\s@]+@smcbi\.edu\.ph$/i.test(email.trim());

/** "c230505" or " C230505@SMCBI.edu.ph " → "c230505@smcbi.edu.ph" (students can type just their ID). */
export const schoolEmail = (input: string) => {
  const v = input.trim().toLowerCase();
  return v && !v.includes('@') ? `${v}@smcbi.edu.ph` : v;
};
