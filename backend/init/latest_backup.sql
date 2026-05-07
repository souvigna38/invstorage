--
-- PostgreSQL database dump
--

\restrict 9FPj12XNJG38nOm3maYSsMRxoIwV7H0BA25UO305M7LiaA3aLdlgqNFx67ZanWh

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.locations DROP CONSTRAINT IF EXISTS locations_parent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_default_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_assigned_to_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.item_images DROP CONSTRAINT IF EXISTS item_images_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_logs DROP CONSTRAINT IF EXISTS action_logs_to_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_logs DROP CONSTRAINT IF EXISTS action_logs_target_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_logs DROP CONSTRAINT IF EXISTS action_logs_performed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.action_logs DROP CONSTRAINT IF EXISTS action_logs_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_logs DROP CONSTRAINT IF EXISTS action_logs_from_location_id_fkey;
DROP INDEX IF EXISTS public.idx_items_status;
DROP INDEX IF EXISTS public.idx_items_search;
DROP INDEX IF EXISTS public.idx_items_location;
DROP INDEX IF EXISTS public.idx_items_deleted_at;
DROP INDEX IF EXISTS public.idx_items_category;
DROP INDEX IF EXISTS public.idx_items_assigned;
DROP INDEX IF EXISTS public.idx_items_asset_tag;
DROP INDEX IF EXISTS public.idx_item_images_item;
DROP INDEX IF EXISTS public.idx_action_logs_user;
DROP INDEX IF EXISTS public.idx_action_logs_type;
DROP INDEX IF EXISTS public.idx_action_logs_item;
DROP INDEX IF EXISTS public.idx_action_logs_date;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.locations DROP CONSTRAINT IF EXISTS locations_pkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_pkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_asset_tag_key;
ALTER TABLE IF EXISTS ONLY public.item_images DROP CONSTRAINT IF EXISTS item_images_pkey;
ALTER TABLE IF EXISTS ONLY public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE IF EXISTS ONLY public.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE IF EXISTS ONLY public.action_logs DROP CONSTRAINT IF EXISTS action_logs_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.locations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.item_images ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.action_logs ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP VIEW IF EXISTS public.product_feed;
DROP SEQUENCE IF EXISTS public.locations_id_seq;
DROP SEQUENCE IF EXISTS public.items_id_seq;
DROP SEQUENCE IF EXISTS public.item_images_id_seq;
DROP TABLE IF EXISTS public.item_images;
DROP VIEW IF EXISTS public.item_history;
DROP VIEW IF EXISTS public.checkout_basket;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.locations;
DROP TABLE IF EXISTS public.items;
DROP SEQUENCE IF EXISTS public.categories_id_seq;
DROP TABLE IF EXISTS public.categories;
DROP SEQUENCE IF EXISTS public.action_logs_id_seq;
DROP TABLE IF EXISTS public.action_logs;
DROP FUNCTION IF EXISTS public.transfer_item(p_item_id integer, p_user_id integer, p_to_location integer, p_note text);
DROP FUNCTION IF EXISTS public.checkout_item(p_item_id integer, p_user_id integer, p_location_id integer, p_note text, p_expected_return date);
DROP FUNCTION IF EXISTS public.checkin_item(p_item_id integer, p_user_id integer, p_location_id integer, p_note text, p_condition numeric);
--
-- Name: checkin_item(integer, integer, integer, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkin_item(p_item_id integer, p_user_id integer, p_location_id integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text, p_condition numeric DEFAULT NULL::numeric) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_location INTEGER;
    v_default_location INTEGER;
BEGIN
    -- Get current and default locations
    SELECT location_id, default_location_id INTO v_current_location, v_default_location
    FROM items WHERE id = p_item_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    -- Update item status
    UPDATE items SET
        status = 'available',
        assigned_to_user_id = NULL,
        location_id = COALESCE(p_location_id, v_default_location, v_current_location),
        last_checkin = NOW(),
        expected_checkin = NULL,
        rating = COALESCE(p_condition, rating),
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log the action
    INSERT INTO action_logs (action_type, performed_by, item_id,
                            from_location_id, to_location_id, note)
    VALUES ('checkin', p_user_id, p_item_id,
            v_current_location, COALESCE(p_location_id, v_default_location),
            p_note);

    RETURN TRUE;
END;
$$;


--
-- Name: checkout_item(integer, integer, integer, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_item(p_item_id integer, p_user_id integer, p_location_id integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text, p_expected_return date DEFAULT NULL::date) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_status VARCHAR(50);
    v_current_location INTEGER;
BEGIN
    -- Get current item status
    SELECT status, location_id INTO v_current_status, v_current_location
    FROM items WHERE id = p_item_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    IF v_current_status != 'available' THEN
        RAISE EXCEPTION 'Item % is not available (current status: %)', p_item_id, v_current_status;
    END IF;

    -- Update item status
    UPDATE items SET
        status = 'checked_out',
        assigned_to_user_id = p_user_id,
        location_id = COALESCE(p_location_id, location_id),
        last_checkout = NOW(),
        expected_checkin = p_expected_return,
        checkout_counter = checkout_counter + 1,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log the action
    INSERT INTO action_logs (action_type, performed_by, item_id, target_user_id,
                            from_location_id, to_location_id, note, expected_return)
    VALUES ('checkout', p_user_id, p_item_id, p_user_id,
            v_current_location, p_location_id, p_note, p_expected_return);

    RETURN TRUE;
END;
$$;


--
-- Name: transfer_item(integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_item(p_item_id integer, p_user_id integer, p_to_location integer, p_note text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_from_location INTEGER;
BEGIN
    SELECT location_id INTO v_from_location
    FROM items WHERE id = p_item_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    UPDATE items SET
        location_id = p_to_location,
        updated_at = NOW()
    WHERE id = p_item_id;

    INSERT INTO action_logs (action_type, performed_by, item_id,
                            from_location_id, to_location_id, note)
    VALUES ('transfer', p_user_id, p_item_id,
            v_from_location, p_to_location, p_note);

    RETURN TRUE;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_logs (
    id integer NOT NULL,
    action_type character varying(50) NOT NULL,
    performed_by integer,
    item_id integer,
    target_user_id integer,
    from_location_id integer,
    to_location_id integer,
    note text,
    action_date timestamp with time zone DEFAULT now(),
    expected_return date,
    attachment_url text,
    source character varying(50) DEFAULT 'web'::character varying,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT action_logs_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['checkout'::character varying, 'checkin'::character varying, 'transfer'::character varying, 'update'::character varying, 'audit'::character varying, 'maintenance'::character varying, 'archive'::character varying, 'restore'::character varying, 'create'::character varying, 'delete'::character varying])::text[])))
);


--
-- Name: action_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.action_logs_id_seq OWNED BY public.action_logs.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    image_url text,
    parent_id integer,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0.00,
    image_url text,
    rating numeric(2,1) DEFAULT 5.0,
    rating_count integer DEFAULT 1,
    asset_tag character varying(255),
    serial_number character varying(255),
    model_name character varying(255),
    model_number character varying(255),
    manufacturer character varying(255),
    category_id integer,
    location_id integer,
    default_location_id integer,
    assigned_to_user_id integer,
    status character varying(50) DEFAULT 'available'::character varying,
    purchase_date date,
    purchase_cost numeric(12,2),
    warranty_months integer,
    warranty_expires date,
    order_number character varying(255),
    supplier character varying(255),
    quantity integer DEFAULT 1,
    is_requestable boolean DEFAULT false,
    last_checkout timestamp with time zone,
    last_checkin timestamp with time zone,
    expected_checkin date,
    checkout_counter integer DEFAULT 0,
    notes text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    cpu_type character varying(255),
    ram_amount character varying(100),
    hard_drive_info character varying(255),
    gpu character varying(255),
    network_info character varying(500),
    role character varying(255),
    storage_detail text,
    CONSTRAINT items_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric))),
    CONSTRAINT items_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'checked_out'::character varying, 'maintenance'::character varying, 'storage'::character varying, 'archived'::character varying, 'lost'::character varying, 'disposed'::character varying])::text[])))
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    address character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100),
    zip character varying(20),
    parent_id integer,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    avatar_url text,
    role character varying(50) DEFAULT 'member'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: checkout_basket; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.checkout_basket AS
 SELECT i.id,
    i.title,
    i.price,
    i.description,
    COALESCE(i.image_url, ''::text) AS image,
    i.quantity,
    i.rating,
    i.rating_count,
    i.assigned_to_user_id AS user_id,
    u.name AS assigned_to_name,
    i.last_checkout,
    i.expected_checkin,
    l.name AS current_location
   FROM ((public.items i
     LEFT JOIN public.users u ON ((i.assigned_to_user_id = u.id)))
     LEFT JOIN public.locations l ON ((i.location_id = l.id)))
  WHERE (((i.status)::text = 'checked_out'::text) AND (i.deleted_at IS NULL));


--
-- Name: item_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.item_history AS
 SELECT al.id AS log_id,
    al.action_type,
    al.action_date,
    al.note,
    i.id AS item_id,
    i.title AS item_title,
    i.image_url AS item_image,
    performer.name AS performed_by_name,
    target.name AS target_user_name,
    fl.name AS from_location,
    tl.name AS to_location,
    al.expected_return
   FROM (((((public.action_logs al
     JOIN public.items i ON ((al.item_id = i.id)))
     LEFT JOIN public.users performer ON ((al.performed_by = performer.id)))
     LEFT JOIN public.users target ON ((al.target_user_id = target.id)))
     LEFT JOIN public.locations fl ON ((al.from_location_id = fl.id)))
     LEFT JOIN public.locations tl ON ((al.to_location_id = tl.id)))
  ORDER BY al.action_date DESC;


--
-- Name: item_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_images (
    id integer NOT NULL,
    item_id integer NOT NULL,
    image_url text NOT NULL,
    alt_text character varying(255),
    display_order integer DEFAULT 0,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: item_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_images_id_seq OWNED BY public.item_images.id;


--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: product_feed; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.product_feed AS
 SELECT i.id,
    i.title,
    i.price,
    i.description,
    c.name AS category,
    c.slug AS category_slug,
    COALESCE(i.image_url, ( SELECT img.image_url
           FROM public.item_images img
          WHERE ((img.item_id = i.id) AND (img.is_primary = true))
         LIMIT 1)) AS image,
    i.rating AS "rating.rate",
    i.rating_count AS "rating.count",
    i.status,
    i.asset_tag,
    i.quantity,
    l.name AS location,
    i.assigned_to_user_id,
    i.last_checkout,
    i.last_checkin
   FROM ((public.items i
     LEFT JOIN public.categories c ON ((i.category_id = c.id)))
     LEFT JOIN public.locations l ON ((i.location_id = l.id)))
  WHERE (i.deleted_at IS NULL);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: action_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs ALTER COLUMN id SET DEFAULT nextval('public.action_logs_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: item_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_images ALTER COLUMN id SET DEFAULT nextval('public.item_images_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: action_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_logs (id, action_type, performed_by, item_id, target_user_id, from_location_id, to_location_id, note, action_date, expected_return, attachment_url, source, ip_address, user_agent, metadata, created_at) FROM stdin;
1	create	1	1	\N	\N	1	Added MacBook Pro to inventory	2024-01-15 00:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
2	checkout	1	1	2	\N	1	Checked out to Sam for daily use	2024-01-15 23:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
3	create	1	4	\N	\N	1	Added Dell monitor to inventory	2023-09-01 04:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
4	checkout	1	4	2	\N	1	Set up at home office desk	2023-09-02 00:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
5	create	1	5	\N	\N	1	Added Aeron chair to inventory	2022-03-15 02:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
6	transfer	1	3	\N	\N	3	Moved iPad to living room for media use	2024-06-01 08:30:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
7	create	1	10	\N	\N	\N	Added Garmin watch to inventory	2023-04-19 23:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
8	checkout	2	10	2	\N	\N	Wearing daily for fitness tracking	2023-04-20 21:00:00+00	\N	\N	web	\N	\N	{}	2026-02-07 18:00:57.022169+00
9	transfer	1	1	\N	1	2	Moved to new location	2026-02-07 18:45:41.791+00	\N	\N	web	\N	\N	{}	2026-02-07 18:45:41.798+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, description, image_url, parent_id, display_order, created_at, updated_at) FROM stdin;
1	Electronics	electronics	Phones, laptops, tablets, cameras	\N	\N	1	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
2	Furniture	furniture	Desks, chairs, shelves, storage	\N	\N	2	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
3	Tools & Equipment	tools-equipment	Power tools, hand tools, safety gear	\N	\N	3	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
4	Kitchen	kitchen	Appliances, cookware, utensils	\N	\N	4	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
5	Books & Media	books-media	Books, DVDs, vinyl, games	\N	\N	5	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
6	Clothing	clothing	Wardrobe items, shoes, accessories	\N	\N	6	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
7	Collectibles	collectibles	Art, antiques, memorabilia	\N	\N	7	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
8	Outdoor & Sports	outdoor-sports	Camping, fitness, bicycles	\N	\N	8	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
9	Office Supplies	office-supplies	Stationery, printers, peripherals	\N	\N	9	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
10	Other	other	Miscellaneous items	\N	\N	10	2026-02-07 18:00:56.97665+00	2026-02-07 18:00:56.97665+00
11	Servers & Networking	servers-networking	Data center compute, storage, and network infrastructure	\N	\N	3	2026-02-07 19:12:13.661694+00	2026-02-07 19:12:13.661694+00
\.


--
-- Data for Name: item_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_images (id, item_id, image_url, alt_text, display_order, is_primary, created_at) FROM stdin;
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.items (id, title, description, price, image_url, rating, rating_count, asset_tag, serial_number, model_name, model_number, manufacturer, category_id, location_id, default_location_id, assigned_to_user_id, status, purchase_date, purchase_cost, warranty_months, warranty_expires, order_number, supplier, quantity, is_requestable, last_checkout, last_checkin, expected_checkin, checkout_counter, notes, custom_fields, created_at, updated_at, deleted_at, cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail) FROM stdin;
2	Sony WH-1000XM5 Headphones	Noise-cancelling wireless headphones. Excellent for focus work.	349.00	https://m.media-amazon.com/images/I/51aXvjzcukL._AC_SL1500_.jpg	4.5	2	ELEC-002	SN-WH1000XM5-2847	WH-1000XM5	WH1000XM5/B	Sony	1	1	1	\N	available	2023-11-20	349.00	12	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
5	Herman Miller Aeron Chair	Size C ergonomic office chair. Graphite frame, remastered.	1695.00	https://m.media-amazon.com/images/I/71+-WVXxs+L._AC_SL1500_.jpg	5.0	4	FURN-001	HM-AER-2024-001	Aeron	AER1C23DWALPVPRSNASNASG1	Herman Miller	2	1	1	\N	available	2022-03-15	1695.00	144	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
6	IKEA BEKANT Standing Desk	160x80cm electric sit/stand desk. White top, white legs.	699.00	https://m.media-amazon.com/images/I/41h02H2XNTL._AC_SL1000_.jpg	4.2	1	FURN-002	\N	BEKANT	120.224.55	IKEA	2	1	1	\N	available	2022-03-20	699.00	120	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
8	Breville Barista Express	Espresso machine with built-in grinder. Daily driver for coffee.	699.00	https://m.media-amazon.com/images/I/71LhLZGFahL._AC_SL1500_.jpg	4.4	3	KTCN-001	BRV-BES870-44721	Barista Express	BES870XL	Breville	4	5	5	\N	available	2023-01-05	699.00	24	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
9	Designing Data-Intensive Applications	Martin Kleppmann. The definitive guide to distributed systems. Hardcover.	42.00	https://m.media-amazon.com/images/I/91YfNb49PLL._SL1500_.jpg	4.9	8	BOOK-001	978-1449373320	\N	978-1449373320	O'Reilly Media	5	1	1	\N	available	2020-06-15	42.00	\N	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
10	Garmin Fenix 7X Solar	GPS multisport watch with solar charging. Used for running and hiking.	899.00	https://m.media-amazon.com/images/I/61vmJCw0raL._AC_SL1500_.jpg	4.7	2	SPRT-001	GMN-F7X-28475	Fenix 7X Solar	010-02541-01	Garmin	8	\N	1	2	checked_out	2023-04-20	899.00	12	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
7	DeWalt 20V MAX Drill Kit	Cordless drill/driver with 2 batteries and charger. Used for home projects.	149.00	https://m.media-amazon.com/images/I/71so0CWPO1L._AC_SL1500_.jpg	4.6	5	TOOL-001	DW-DCD771C2-9283	DCD771C2	DCD771C2	DeWalt	3	2	2	\N	available	2021-08-10	149.00	36	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
1	MacBook Pro 16" M3 Max	Primary development laptop. 64GB RAM, 1TB SSD. Used for all coding projects.	4299.00	https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202310	4.8	3	ELEC-001	C02ZN1MDLVDL	MacBook Pro 16"	A2991	Apple	1	2	1	2	checked_out	2024-01-15	4299.00	12	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:45:41.762+00	\N	Apple M3 Max (16-core)	48 GB Unified	1 TB SSD	\N	\N	\N	\N
3	iPad Pro 12.9" M2	Drawing tablet and secondary screen. 256GB WiFi model.	1199.00	https://m.media-amazon.com/images/I/81gqHuHXkYL._AC_SL1500_.jpg	4.7	1	ELEC-003	DLXZ92HCQF	iPad Pro 12.9"	MNXR3LL/A	Apple	1	3	1	\N	available	2023-06-10	1199.00	12	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	Apple M2 (8-core)	8 GB Unified	256 GB SSD	\N	\N	\N	\N
4	Dell U3423WE Monitor	34-inch ultrawide USB-C hub monitor for home office.	819.00	https://m.media-amazon.com/images/I/81pGjfBW4NL._AC_SL1500_.jpg	4.3	2	ELEC-004	CN-0F2JMN-FCC00	U3423WE	U3423WE	Dell	1	1	1	2	checked_out	2023-09-01	819.00	36	\N	\N	\N	1	f	\N	\N	\N	0	\N	{}	2026-02-07 18:00:57.017847+00	2026-02-07 18:00:57.017847+00	\N	\N	\N	\N	\N	\N	\N	\N
11	Cisco UCS C220 M5 — "Cisco" Compute Node	Stateless Calculation Engine.\n\nThis machine is designed to eliminate I/O latency entirely. By loading the dataset into a ~600GB RAM Disk, it executes the Viterbi and Baum-Welch algorithms in nanoseconds without waiting for hard drives. It is "stateless," meaning it relies on BigBrain for data persistence.	12500.00	https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=400&fit=crop	5.0	1	SRV-CISCO-001	FCH2138V1AB	UCS C220 M5	UCSC-C220-M5SX	Cisco	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	All 24 DIMM slots populated for maximum memory bandwidth. Data storage is entirely in RAM Disk. Relies on BigBrain for persistence.	{}	2026-02-07 19:13:50.45046+00	2026-02-07 19:13:50.45046+00	\N	2x Intel Xeon Gold 6130 (32 Cores / 64 Threads @ 2.1 GHz)	768 GB DDR4 ECC (24 x 32GB) — All slots filled	228 GB SSD (SATA) — Boot Drive only	\N	4x 10G Base-T (Copper) → LACP Bond (40Gbps)	Stateless Calculation Engine	Boot: 228 GB SSD (SATA)\nData Storage: None (Uses RAM Disk ~600GB)
12	Dell PowerEdge R730xd — "BigBrain" Database Node	High-Frequency Transactional Database.\n\nOptimized for low latency and high throughput. The high-clock-speed CPUs (3.2GHz) handle complex queries quickly, while the dedicated 15k RPM log drives ensure that heavy write operations never block the main data array. It serves as the "Source of Truth" for the cluster.	18000.00	https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&h=400&fit=crop	5.0	1	SRV-BIGBRAIN-001	JNKF732	PowerEdge R730xd	R730xd-24Bay	Dell	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	24-Bay chassis. Tier 1 WAL logs on dedicated 15k RPM spindles ensures writes never block the main data array. Source of Truth for the cluster.	{}	2026-02-07 19:13:50.458757+00	2026-02-07 19:13:50.458757+00	\N	2x Intel Xeon E5-2667 v4 (16 Cores / 32 Threads @ 3.2 GHz)	128 GB DDR4 ECC (4 x 32GB)	120 GB SSD (SATA) — Boot Drive in Slot 20	\N	2x 10G SFP+ (Fiber) → LACP Bond (20Gbps)	High-Frequency Transactional Database	Boot: 120 GB SSD (SATA) Slot 20\nTier 1 (Logs): 4x 600GB 15k SAS RAID 10 → /var/lib/postgresql/wal\nTier 2 (Data): 16x 1.2TB 10k SAS RAID 10 → /var/lib/postgresql/data
13	Custom Workstation — "Hal" Inference Node	Hybrid Pre-Processing & GPU Inference.\n\nA dual-purpose heavy lifter. It uses its massive 88-thread CPU count to "chunk," format, and normalize raw data in parallel. It then feeds these matrices to the RTX 5070 for hardware-accelerated deep learning inference, returning the results to Vault.	9500.00	https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&h=400&fit=crop	5.0	1	SRV-HAL-001	HAL-WS-2024	Custom Workstation / Server	CUSTOM-DUAL-E5	Custom Build	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	88 threads for parallel data chunking/normalization. GPU-accelerated deep learning inference via RTX 5070. Returns results to Vault.	{}	2026-02-07 19:13:50.459946+00	2026-02-07 19:13:50.459946+00	\N	2x Intel Xeon E5-2699 v4 (44 Cores / 88 Threads @ 2.2 GHz)	64 GB DDR4 ECC (2 x 32GB)	2 TB SSD (SATA/NVMe)	NVIDIA RTX 5070 (16 GB GDDR7)	1x 10G SFP+ (Fiber)	Hybrid Pre-Processing & GPU Inference	2 TB SSD (SATA/NVMe)
20	Acer ConceptD CN516-72G — "ConceptD"	The Canvas: Design/UI.\n\nThe creative workstation dedicated to front-end design, UI/UX prototyping, and visual asset creation. Its color-accurate display and dedicated GPU make it the go-to machine for building dashboards, designing interfaces, and producing documentation graphics for the cluster ecosystem.	1800.00	https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&h=400&fit=crop	5.0	1	WS-CONCEPTD-001	NXCB2SA001	ConceptD CN516-72G	CN516-72G	Acer	11	6	6	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: Windows 11 Pro | VLAN: 100 (Trusted) | SpatialLabs Edition\nStereoscopic 3D display for immersive data visualization. Dedicated creative workstation for UI/UX design, dashboard building, and visual asset creation.\nGPU-accelerated rendering via RTX 3060.	{}	2026-02-07 19:23:06.877284+00	2026-02-07 19:23:06.877284+00	\N	Intel Core i7-11800H (8 Cores / 16 Threads)	16 GB DDR4	\N	NVIDIA RTX 3060	Wi-Fi 6 — VLAN 100 (Trusted)	The Canvas: Design/UI	\N
17	HP ProLiant DL380 G6 — "Temp-Data-1"	The Hot Zone: Raw Ingest (Dirty).\n\nThe first stage of the data pipeline. All raw, unvalidated data lands here. This machine absorbs high-volume incoming feeds without contaminating the clean production databases. Once data is validated and normalized, it is promoted to Temp-Data-2 for staging.	2800.00	https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=600&h=400&fit=crop	5.0	1	SRV-TEMPDATA1-001	MXQ9420ABC	ProLiant DL380 G6	DL380-G6	HP	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: Ubuntu 24.04 | VLAN: 666 (Hazard) | Swarm Node A\nPre-Processing Node. First stage of data pipeline. All raw, unvalidated data lands here before promotion to Temp-Data-2.\nKeeps dirty data isolated from production. Samba / NFS Dump target for raw ingest.	{}	2026-02-07 19:21:02.96604+00	2026-02-07 19:21:02.96604+00	\N	2x Intel Xeon X5600 Series	144 GB DDR3 ECC	8x 300GB 10k SAS	\N	4x 1GbE (LACP Bond) — VLAN 666 (Hazard)	The Hot Zone: Raw Ingest (Dirty)	8x 300GB 10k SAS (2.4 TB raw)\nRAID configuration for raw data ingest
15	Netgear M4300-12X12F — Network Fabric Switch	High-Throughput Cluster Backplane.\n\nBonds physically separate machines into a single logical unit. The 40Gb/20Gb aggregations ensure that network bandwidth exceeds disk speed, guaranteeing that no CPU ever sits idle waiting for a file transfer.	3500.00	https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&h=400&fit=crop	5.0	1	NET-FABRIC-001	NGEAR-M4300-7AX	M4300-12X12F	XSM4324S	Netgear	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	12x 10G SFP+ ports + 12x 10G Base-T ports. LACP bonding enabled. Isolated subnet with no internet access. Jumbo frames for max throughput.	{}	2026-02-07 19:13:50.461628+00	2026-02-07 19:13:50.461628+00	\N	\N	\N	\N	\N	Layer 2 Switching | Jumbo Frames MTU 9000 | Subnet: 192.168.100.x (Isolated)	High-Throughput Cluster Backplane	\N
19	Mac Pro (Tower) — "Oracle"	The Airlock: Sanitization Bridge.\n\nRunning Ubuntu 24.04, Oracle acts as the gateway between untrusted external data and the secure cluster network. All inbound data must pass through Oracle's validation and sanitization pipeline before it is allowed onto the cluster subnet. Think of it as the immune system — nothing dirty gets past.	3500.00	https://m.media-amazon.com/images/I/71an9eiBxpL._AC_SL1500_.jpg	5.0	1	WS-ORACLE-001	C02XM0XXHTD	Mac Pro (Tower)	MacPro7,1	Apple	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Running Ubuntu 24.04. Gateway between untrusted external data and the secure cluster. All inbound data passes through validation/sanitization before reaching the cluster subnet.	{}	2026-02-07 19:23:06.872705+00	2026-02-07 19:23:06.872705+00	\N	Dual Intel Xeon	32 GB DDR4 ECC	\N	\N	\N	The Airlock: Sanitization Bridge	\N
22	MacBook Pro 16" (2019) — "SP7"	Legacy Bridge Node.\n\nMaintains compatibility with older x86-only toolchains and legacy systems. SP7 serves as the bridge between modern ARM-based workflows and legacy Intel dependencies, ensuring nothing falls through the cracks during architecture transitions.	1200.00	https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop	4.0	1	WS-SP7-001	C02ZK1XXMD7S	MacBook Pro 16" (2019)	MacBookPro16,1	Apple	11	6	6	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: macOS Sonoma | VLAN: 666 (Hazard) | Clean Build\nLegacy Bridge Node. Intermediate processing. Maintains compatibility with older x86-only toolchains.\nBridges modern ARM workflows and legacy Intel dependencies.	{}	2026-02-07 19:23:06.878679+00	2026-02-07 19:23:06.878679+00	\N	Intel Core i7-9750H (6 Cores / 12 Threads @ 2.6 GHz)	16 GB DDR4	\N	\N	Wi-Fi 5 (ac) — VLAN 666 (Hazard)	Legacy Bridge Node	\N
14	Dell PowerEdge R510 — "Vault" Archive Node	Disaster Recovery & Long-Term Storage.\n\nThe safety net. It continuously ingests Write-Ahead Logs (WAL) from BigBrain for point-in-time recovery. It also serves as the final destination for the massive results files generated by Cisco and Hal, keeping the high-speed tiers free for active work.	6000.00	https://images.unsplash.com/photo-1484662020986-75935d2ebc66?w=600&h=400&fit=crop	5.0	1	SRV-VAULT-001	VAULT-ZFS-001	Dell PowerEdge R510 (12-Bay)	R510-12Bay	Dell	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: Ubuntu 24.04 Server | VLAN: 20 (Storage)\nContinuously ingests WAL from BigBrain for point-in-time recovery. Final destination for results files from Cisco and Hal.\n12x 3.5" hot-swap bays, H200 in IT Mode for direct disk access. Long-term archival repository.	{}	2026-02-07 19:13:50.460828+00	2026-02-07 19:13:50.460828+00	\N	2x Intel Xeon E5645 (12 Cores / 24 Threads)	32 GB DDR3	Pool A: 24 TB (Main Backup) | Pool B: 16 TB (Archive)	\N	2x 10G SFP+ (Fiber) → LACP Bond (20Gbps)	Disaster Recovery & Long-Term Storage	Controller: H200 (IT Mode)\nBoot: 500 GB SSD\n12x 3.5" Drive Bays — 24 TB Raw XFS Array\nStorage Pool A: 24 TB (Main Backup)\nStorage Pool B: 16 TB (Archive)
26	SonicWall NSA 5650 — "Sentinel"	Secure Gateway: Malware & C&C Defense.\n\nThe perimeter guardian. Sentinel performs deep packet inspection with SSL decryption (DPI-SSL) and intrusion prevention (IPS) at 10G line rate. Every byte entering or leaving the network is scanned for malware signatures, command-and-control callbacks, and anomalous traffic patterns. Nothing gets in or out without Sentinel's approval.	8500.00	https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=600&h=400&fit=crop	5.0	1	NET-SENTINEL-001	SNW-5650-AX1	NSA 5650	NSA5650	SonicWall	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Perimeter firewall. Scans all traffic for malware signatures, C&C callbacks, and anomalous patterns at 10G line rate. DPI-SSL decrypts and inspects encrypted traffic.	{}	2026-02-07 19:25:33.250489+00	2026-02-07 19:25:33.250489+00	\N	\N	\N	\N	\N	10G DPI-SSL / IPS — Deep Packet Inspection with SSL Decryption & Intrusion Prevention	Secure Gateway: Malware & C&C Defense	\N
27	Netgear M4300-24x24F — "Clean-Core"	Sanctuary Switch: AI & Database Backbone.\n\nThe trusted core of the network. Clean-Core connects all production-grade machines — BigBrain, Cisco, Hal, and Vault — on the clean VLAN. With 24x 10G fiber ports and Layer 3 routing, it provides the high-bandwidth, low-latency backbone that the AI compute and database tiers demand. Only sanitized, validated traffic touches this switch.	6500.00	https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=600&h=400&fit=crop	5.0	1	NET-CLEANCORE-001	NGEAR-M4300-24F-1A	M4300-24x24F	XSM4348S	Netgear	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Trusted core switch for the clean VLAN. Connects BigBrain, Cisco, Hal, and Vault. Only sanitized/validated traffic allowed. L3 routing between production subnets.	{}	2026-02-07 19:25:33.257638+00	2026-02-07 19:25:33.257638+00	\N	\N	\N	\N	\N	24x 10G SFP+ (Fiber) / Layer 3 Routing — Jumbo Frames MTU 9000	Sanctuary Switch: AI & Database Backbone	\N
28	Netgear M4300-12x12F — "Dirty-Core"	Hazard Switch: Ingest & Swarm Backbone.\n\nThe untrusted side of the network. Dirty-Core handles all raw ingest traffic — Temp-Data-1, Temp-Data-2, Yondex swarm nodes, and any external data feeds. With 12x 10G fiber and Layer 3 routing, it isolates potentially dangerous or unvalidated traffic from ever touching the clean production backbone.	3500.00	https://images.unsplash.com/photo-1562408590-e32931084e23?w=600&h=400&fit=crop	5.0	1	NET-DIRTYCORE-001	NGEAR-M4300-12F-2B	M4300-12x12F	XSM4324S	Netgear	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Untrusted core switch for the dirty VLAN. Handles Temp-Data-1/2, Yondex swarm, and external feeds. Isolates unvalidated traffic from the clean production backbone.	{}	2026-02-07 19:25:33.258469+00	2026-02-07 19:25:33.258469+00	\N	\N	\N	\N	\N	12x 10G SFP+ (Fiber) / Layer 3 Routing — Jumbo Frames MTU 9000	Hazard Switch: Ingest & Swarm Backbone	\N
29	Netgear S3300-52X — "Access"	The Split Switch: Wired Access (VLAN 100/666).\n\nThe edge access layer. Access provides 48x 1G copper ports for workstations and laptops, with 4x 10G uplinks to the core switches. VLAN 100 carries trusted clean traffic to Clean-Core, while VLAN 666 routes dirty/ingest traffic to Dirty-Core. One switch, two worlds — physically the same box, logically completely separated.	1800.00	https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop	5.0	1	NET-ACCESS-001	NGEAR-S3300-52X-3C	S3300-52X	GS752TXS	Netgear	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Edge access layer. 48 copper ports for workstations. VLAN 100 → Clean-Core (trusted), VLAN 666 → Dirty-Core (ingest/untrusted). One box, two logically separated worlds.	{}	2026-02-07 19:25:33.259197+00	2026-02-07 19:25:33.259197+00	\N	\N	\N	\N	\N	48x 1G Base-T (Copper) / 4x 10G SFP+ Uplink — VLAN 100 (Clean) / VLAN 666 (Dirty)	The Split Switch: Wired Access (VLAN 100/666)	\N
30	Totolink Wireless AP — "Hazmat-AP"	Dirty Wi-Fi: Air-Gapped Swarm Access.\n\nA dedicated wireless access point operating in isolation mode on the dirty VLAN (666). Hazmat-AP provides Wi-Fi 6 connectivity exclusively for swarm agents, mobile test devices, and any wireless node that needs to touch the ingest pipeline without risking contamination of the clean network. Client isolation prevents lateral movement between connected devices.	120.00	https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=600&h=400&fit=crop	4.0	1	NET-HAZMATAP-001	TOTO-AP-WIFI6-1D	Totolink Wireless AP	AX3600R	Totolink	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Dedicated Wi-Fi AP on dirty VLAN 666. Client isolation enabled — no lateral movement between devices. For swarm agents, mobile test devices, and ingest pipeline wireless access only.	{}	2026-02-07 19:25:33.260007+00	2026-02-07 19:25:33.260007+00	\N	\N	\N	\N	\N	Wi-Fi 6 (802.11ax) / Isolation Mode — VLAN 666 (Dirty) Only	Dirty Wi-Fi: Air-Gapped Swarm Access	\N
18	HP ProLiant DL380 G6 — "Temp-Data-2"	The Clean Room: Staging Database.\n\nThe second stage of the data pipeline. Only validated and normalized data from Temp-Data-1 is promoted here. This staging database mirrors the production schema, allowing final quality checks before data is committed to BigBrain as the Source of Truth.	2800.00	https://images.unsplash.com/photo-1600267185393-e158a98703de?w=600&h=400&fit=crop	5.0	1	SRV-TEMPDATA2-001	MXQ9420DEF	ProLiant DL380 G6	DL380-G6	HP	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: Ubuntu 24.04 | VLAN: 666 (Hazard) | Swarm Node B\nStructured Data Node. Second stage of data pipeline. Only validated/normalized data promoted here from Temp-Data-1.\nMirrors production schema for final QA before commit to BigBrain. Runs PostgreSQL / MySQL staging databases.	{}	2026-02-07 19:21:02.966749+00	2026-02-07 19:21:02.966749+00	\N	2x Intel Xeon X5600 Series	144 GB DDR3 ECC	8x 300GB 10k SAS	\N	4x 1GbE (LACP Bond) — VLAN 666 (Hazard)	The Clean Room: Staging Database	8x 300GB 10k SAS (2.4 TB raw)\nRAID configuration for staging database
31	Dell PowerEdge R510 (8-Bay) — "Gatekeeper"	Firewall: Edge Security.\n\nThe network's front door. Running pfSense Plus, Gatekeeper handles all VLAN management, VPN termination, and perimeter firewall rules. With a dedicated quad-port NIC bonded via LACP, it provides redundant connectivity while inspecting and routing traffic between the WAN, clean VLAN, and dirty VLAN. A dedicated security appliance — nothing else runs on this box.	2200.00	https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&h=400&fit=crop	5.0	1	NET-GATEKEEPER-001	JNKF-R510-GK1	PowerEdge R510 (8-Bay)	R510-8Bay	Dell	11	8	8	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: pfSense Plus | Dedicated Security Appliance\nEdge firewall handling all VLAN management, VPN termination, and perimeter rules.\nWAN: 1GbE | LAN: 3x LACP bonded from quad-port NIC.\n8-Bay chassis repurposed as dedicated security appliance.	{}	2026-02-07 19:34:24.248649+00	2026-02-07 19:34:24.248649+00	\N	2x Intel Xeon E5620 (8 Cores / 16 Threads)	64 GB DDR3	4x 1TB SATA	\N	WAN: 1GbE | LAN: 4x 1GbE Quad Port NIC (3x LACP Bond) — VLAN Management / VPN	Firewall: Edge Security	Boot: 120 GB SSD\nData: 4x 1TB SATA
21	MacBook Pro 16" (2019) — "SP9"	High-End x86 Build Node.\n\nThe heavy-duty Intel build machine. With an i9 processor and 64GB of RAM, SP9 handles large compilation jobs, cross-platform builds, and x86-native testing. Dual-boots macOS and Windows, making it the swiss army knife for platform-specific development and compatibility testing.	2800.00	https://m.media-amazon.com/images/I/71pC69I3lzL._AC_SL1500_.jpg	5.0	1	WS-SP9-001	C02ZK1XXMD6R	MacBook Pro 16" (2019)	MacBookPro16,1	Apple	11	6	6	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: macOS / Windows 10 (Boot Camp) | VLAN: 666 (Hazard) | VM Host\nHeavy Build Node. x86 compilation and VM lab. Heavy-duty Intel build machine for large compilations, cross-platform builds, and x86-native testing.\nRuns virtual machines for isolated build and test environments.	{}	2026-02-07 19:23:06.877997+00	2026-02-07 19:23:06.877997+00	\N	Intel Core i9-9980HK (8 Cores / 16 Threads @ 2.4 GHz)	64 GB DDR4	\N	\N	Wi-Fi 5 (ac) — VLAN 666 (Hazard)	High-End x86 Build Node	\N
23	MacBook Air (M1) — "SPM1"	The Scout: Mobile Inference.\n\nUltra-portable ARM-based inference node. The M1's unified memory architecture and Neural Engine allow SPM1 to run lightweight ML models on the go with exceptional power efficiency. Perfect for field testing, remote monitoring, and mobile development when away from the cluster.	1100.00	https://m.media-amazon.com/images/I/71vFKBpKakL._AC_SL1500_.jpg	5.0	1	WS-SPM1-001	C02FL0XXPN6Q	MacBook Air (M1)	MacBookAir10,1	Apple	11	6	6	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: macOS Sonoma | VLAN: 666 (Hazard) | Fanless Design\nThe Scout. Mobile inference and SSH gateway. Ultra-portable ARM inference node.\nM1 Neural Engine for lightweight ML models, field testing, and remote monitoring. Silent operation.	{}	2026-02-07 19:23:06.879389+00	2026-02-07 19:23:06.879389+00	\N	Apple M1 (8-Core CPU / 8-Core GPU / 16-Core Neural Engine)	16 GB Unified Memory	\N	\N	Wi-Fi 6 (ax) — VLAN 666 (Hazard)	The Scout: Mobile Inference	\N
25	Toshiba Qosmio X70 — "Yondex"	Juju Controller: Swarm Commander.\n\nThe orchestration brain running Ubuntu 24.04 with Canonical Juju. Yondex manages the deployment, scaling, and lifecycle of all services across the cluster. Despite its older hardware, 32GB of RAM and a quad-core i7 are more than sufficient for running the Juju controller and coordinating the swarm.	800.00	https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&h=400&fit=crop	4.0	1	WS-YONDEX-001	Z9120456YX	Qosmio X70	PSPLTU-00H007	Toshiba	11	7	7	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: Ubuntu 24.04 Server | VLAN: 666 (Hazard) | Headless\nJuju Controller. Cluster orchestration swarm commander. Canonical Juju manages deployment, scaling, and lifecycle of all services.\nHeadless operation — SSH/API access only. No display attached.	{}	2026-02-07 19:23:06.880567+00	2026-02-07 19:23:06.880567+00	\N	Intel Core i7-4700MQ (4 Cores / 8 Threads @ 2.4 GHz)	32 GB DDR3	\N	\N	1GbE Wired — VLAN 666 (Hazard)	Juju Controller: Swarm Commander	\N
16	Lenovo ThinkPad T15g Gen 2 — "Frank"	Field Commander: Local AI & Recovery.\n\nA mobile powerhouse built for on-site operations. Equipped with a workstation-class Xeon CPU and a full RTX 3080 laptop GPU, Frank can run local AI inference, serve as a portable recovery console, and act as an emergency command node if the primary cluster goes down.	4200.00	https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&h=400&fit=crop	5.0	1	SRV-FRANK-001	PF-3KXYZ1	ThinkPad T15g Gen 2	20YS-CTO	Lenovo	11	6	6	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	OS: Windows 11 Pro / WSL2 | VLAN: 100 (Trusted)\nMobile workstation. Xeon W-class CPU + full RTX 3080 for portable AI inference and emergency cluster recovery operations.\nDisaster Recovery Console — can serve as fallback command node if primary cluster goes down.	{}	2026-02-07 19:21:02.961308+00	2026-02-07 19:21:02.961308+00	\N	Intel Xeon W-11855M (6 Cores / 12 Threads)	64 GB DDR4	2 TB NVMe (Gen4)	NVIDIA RTX 3080 Laptop (16 GB GDDR6)	2.5GbE Ethernet + Wi-Fi 6E — VLAN 100 (Trusted)	Field Commander: Local AI & Recovery	2 TB NVMe Gen4 SSD
24	MacBook Air (M1) — "SPM2"	Moltbot Sandbox: Autonomous Agent.\n\nAn isolated, network-restricted M1 machine dedicated to running autonomous AI agents. SPM2 is intentionally air-gapped from the production cluster to prevent uncontrolled agent behavior from affecting live systems. All agent experiments run here first before promotion to the main cluster.	1100.00	https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/macbook-air-midnight-select-20220606	5.0	1	WS-SPM2-001	C02FL0XXPN7R	MacBook Air (M1)	MacBookAir10,1	Apple	11	6	6	\N	available	\N	\N	\N	\N	\N	\N	1	f	\N	\N	\N	0	Running macOS (Isolated). Air-gapped from production cluster. Dedicated to autonomous AI agent experiments. Prevents uncontrolled agent behavior from affecting live systems.	{}	2026-02-07 19:23:06.879988+00	2026-02-07 19:23:06.879988+00	\N	Apple M1 (8-Core CPU / 8-Core GPU / 16-Core Neural Engine)	16 GB Unified Memory	\N	\N	\N	Moltbot Sandbox: Autonomous Agent	\N
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.locations (id, name, description, address, city, state, country, zip, parent_id, image_url, created_at, updated_at) FROM stdin;
1	Home Office	Primary workspace	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 18:00:57.01706+00	2026-02-07 18:00:57.01706+00
2	Garage	Tool storage & workshop	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 18:00:57.01706+00	2026-02-07 18:00:57.01706+00
3	Living Room	Main living area	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 18:00:57.01706+00	2026-02-07 18:00:57.01706+00
4	Storage Unit	Off-site storage facility	45 Industrial Ave	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 18:00:57.01706+00	2026-02-07 18:00:57.01706+00
5	Kitchen	Kitchen & pantry	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 18:00:57.01706+00	2026-02-07 18:00:57.01706+00
6	Server Room	Primary data center rack	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 19:12:13.661694+00	2026-02-07 19:12:13.661694+00
7	Server Rack A	Main compute rack	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 19:12:13.661694+00	2026-02-07 19:12:13.661694+00
8	Server Rack B	Storage and network rack	123 Main St	Brisbane	QLD	AU	\N	\N	\N	2026-02-07 19:12:13.661694+00	2026-02-07 19:12:13.661694+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, avatar_url, role, created_at, updated_at) FROM stdin;
1	Admin	admin@inventory.local	\N	admin	2026-02-07 18:00:57.015635+00	2026-02-07 18:00:57.015635+00
2	Sam Parker	sam@inventory.local	\N	member	2026-02-07 18:00:57.015635+00	2026-02-07 18:00:57.015635+00
\.


--
-- Name: action_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.action_logs_id_seq', 9, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 11, true);


--
-- Name: item_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_images_id_seq', 1, false);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.items_id_seq', 31, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.locations_id_seq', 8, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: action_logs action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: item_images item_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_images
    ADD CONSTRAINT item_images_pkey PRIMARY KEY (id);


--
-- Name: items items_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_asset_tag_key UNIQUE (asset_tag);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_action_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_date ON public.action_logs USING btree (action_date);


--
-- Name: idx_action_logs_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_item ON public.action_logs USING btree (item_id);


--
-- Name: idx_action_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_type ON public.action_logs USING btree (action_type);


--
-- Name: idx_action_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_user ON public.action_logs USING btree (performed_by);


--
-- Name: idx_item_images_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_images_item ON public.item_images USING btree (item_id);


--
-- Name: idx_items_asset_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_asset_tag ON public.items USING btree (asset_tag);


--
-- Name: idx_items_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_assigned ON public.items USING btree (assigned_to_user_id);


--
-- Name: idx_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_category ON public.items USING btree (category_id);


--
-- Name: idx_items_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_deleted_at ON public.items USING btree (deleted_at);


--
-- Name: idx_items_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_location ON public.items USING btree (location_id);


--
-- Name: idx_items_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_search ON public.items USING gin (to_tsvector('english'::regconfig, (((((((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || (COALESCE(model_name, ''::character varying))::text) || ' '::text) || (COALESCE(manufacturer, ''::character varying))::text)));


--
-- Name: idx_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_status ON public.items USING btree (status);


--
-- Name: action_logs action_logs_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: action_logs action_logs_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: action_logs action_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_logs action_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_logs action_logs_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: item_images item_images_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_images
    ADD CONSTRAINT item_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: items items_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: items items_default_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_default_location_id_fkey FOREIGN KEY (default_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: items items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 9FPj12XNJG38nOm3maYSsMRxoIwV7H0BA25UO305M7LiaA3aLdlgqNFx67ZanWh

