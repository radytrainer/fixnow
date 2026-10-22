-- Order of demo accounts on the sign-in screen: featured accounts get a rank, everyone else follows by name.
ALTER TABLE users ADD COLUMN demo_rank int;
