-- is_user_token_valid checks the user_token or user_token_temp and returns true/false
CREATE OR REPLACE FUNCTION _meta.is_user_token_valid(i_user_id TEXT, i_user_token TEXT, i_provider TEXT, i_timestamp BIGINT, i_temp_token BOOLEAN, i_temp_max_age BOOLEAN) RETURNS boolean AS $$
DECLARE
    v_user_token_secret TEXT;
    v_user_token_max_age_in_seconds BIGINT;
    v_auth_table TEXT;
    v_auth_table_schema TEXT;
    v_auth_field_password TEXT;
    v_query TEXT;
    v_pw_hash TEXT;
    v_user_id TEXT;
    v_total_logout BIGINT;
    v_invalid_tokens TEXT[];
    v_invalid_token_position INT;
    v_timestamp BIGINT;
    v_timestamp_sec INT;
    v_payload TEXT;
    v_user_token TEXT;
BEGIN
    -- Get the correct secret for the current check
    IF i_temp_token = true THEN
        SELECT value INTO v_user_token_secret FROM _meta."Auth" WHERE key = 'user_token_temp_secret';
    ELSE
        SELECT value INTO v_user_token_secret FROM _meta."Auth" WHERE key = 'user_token_secret';
    END IF;

    -- Get the correct max-age for the current check
    IF i_temp_max_age = true THEN
        SELECT value INTO v_user_token_max_age_in_seconds FROM _meta."Auth" WHERE key = 'user_token_temp_max_age_in_seconds';
    ELSE
        SELECT value INTO v_user_token_max_age_in_seconds FROM _meta."Auth" WHERE key = 'user_token_max_age_in_seconds';
    END IF;

    -- TODO: We may could improve this to one query
    -- Get required values from Auth-table
    SELECT value INTO v_auth_table FROM _meta."Auth" WHERE key = 'auth_table';
    SELECT value INTO v_auth_table_schema FROM _meta."Auth" WHERE key = 'auth_table_schema';
    SELECT value INTO v_auth_field_password FROM _meta."Auth" WHERE key = 'auth_field_password';

    -- Get current timestamp
    v_timestamp := (round(extract(epoch from now())*1000))::bigint;

    -- Check if token is expired
    IF v_timestamp - i_timestamp > (v_user_token_max_age_in_seconds * 1000) THEN
        RETURN false;
    END IF;

    -- Get pwHash, invalidTokens, totalLogoutTimestamp and userId from user by userId and provider
    v_query := $tok$SELECT %I->'providers'->%L->>'hash', id, %I->>'totalLogoutTimestamp', ARRAY(SELECT jsonb_array_elements_text(%I->'invalidTokens')) FROM %I.%I WHERE id = %L$tok$;
    EXECUTE format(v_query, v_auth_field_password, i_provider, v_auth_field_password, v_auth_field_password, v_auth_table_schema, v_auth_table, i_user_id) INTO v_pw_hash, v_user_id, v_total_logout, v_invalid_tokens;

    -- Check the loaded variables to not be null
    IF v_pw_hash IS NULL OR v_user_id IS NULL OR v_total_logout IS NULL OR v_invalid_tokens IS NULL THEN
        RETURN false;
    END IF;

    -- Check if the token is issued before the totalLogoutTimestamp. If yes it is invalid.
    IF v_total_logout >= i_timestamp THEN
        RETURN false;
    END IF;

    -- Get the position of the token-timestamp in the invalidTimestamps array
    v_invalid_token_position := array_position(v_invalid_tokens, i_timestamp::text);

    -- If the position is not null, the token-timestamp is in the list and thereby invalid.
    IF v_invalid_token_position IS NOT NULL THEN
        RETURN false;
    END IF;

    -- Recreate the signature-payload of the user-token to check it
    v_payload := v_pw_hash || ':' || i_timestamp || ':' || v_user_token_secret;

    -- We need to hash the payload with sha256 before bf crypt because bf only accepts up to 72 chars
    -- Recreate the user-token by hashing the payload
    v_user_token := crypt(encode(digest(v_payload, 'sha256'), 'hex'), i_user_token);

    -- Check if the input-user-token matches the recreated one
    IF i_user_token != v_user_token THEN
        RETURN false;
    END IF;

    -- If nothing raises or returns false until here the token is valid => Return true
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;