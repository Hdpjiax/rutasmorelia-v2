-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigger Function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Profiles (User profiles linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Routes (Transit routes metadata)
CREATE TABLE IF NOT EXISTS public.routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  casing_color TEXT NOT NULL DEFAULT '#222222',
  transport_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('approved', 'needs_review', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Route Variants (Variants of a route)
CREATE TABLE IF NOT EXISTS public.route_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id TEXT REFERENCES public.routes ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_route_variants_updated_at
  BEFORE UPDATE ON public.route_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Route Shapes (Geometry lines)
CREATE TABLE IF NOT EXISTS public.route_shapes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id TEXT REFERENCES public.routes ON DELETE CASCADE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('ida', 'vuelta')),
  geom GEOMETRY(LineString, 4326) NOT NULL,
  matched_to_osm BOOLEAN NOT NULL DEFAULT FALSE,
  qa_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (qa_status IN ('approved', 'needs_review', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_route_shapes_updated_at
  BEFORE UPDATE ON public.route_shapes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Route Segments (Segment level geometry if needed)
CREATE TABLE IF NOT EXISTS public.route_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_shape_id UUID REFERENCES public.route_shapes ON DELETE CASCADE NOT NULL,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  sequence_number INTEGER NOT NULL,
  matched_to_osm BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_route_segments_updated_at
  BEFORE UPDATE ON public.route_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Route Transfer Points (Transfer points between routes)
CREATE TABLE IF NOT EXISTS public.route_transfer_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id_1 TEXT REFERENCES public.routes ON DELETE CASCADE NOT NULL,
  route_id_2 TEXT REFERENCES public.routes ON DELETE CASCADE NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_route_transfer_points_updated_at
  BEFORE UPDATE ON public.route_transfer_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Places (System-defined places/landmarks)
CREATE TABLE IF NOT EXISTS public.places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  geom GEOMETRY(Point, 4326) NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_places_updated_at
  BEFORE UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Favorite Places (User favorite places)
CREATE TABLE IF NOT EXISTS public.favorite_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  place_id UUID REFERENCES public.places ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, place_id)
);

-- 9. Favorite Routes (User favorite routes)
CREATE TABLE IF NOT EXISTS public.favorite_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  route_id TEXT REFERENCES public.routes ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, route_id)
);

-- 10. Recent Searches (User search history)
CREATE TABLE IF NOT EXISTS public.recent_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  search_type TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. Dataset Versions (To track data imports)
CREATE TABLE IF NOT EXISTS public.dataset_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TRIGGER update_dataset_versions_updated_at
  BEFORE UPDATE ON public.dataset_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. GIS Quality Reports (To log QA validation results)
CREATE TABLE IF NOT EXISTS public.gis_quality_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_shape_id UUID REFERENCES public.route_shapes ON DELETE CASCADE NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL,
  validation_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- Spatial GiST Indexes
CREATE INDEX IF NOT EXISTS idx_route_shapes_geom ON public.route_shapes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_route_segments_geom ON public.route_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_route_transfer_points_geom ON public.route_transfer_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_places_geom ON public.places USING GIST (geom);

-- Foreign Key & Common Query Column Indexes
CREATE INDEX IF NOT EXISTS idx_route_shapes_route_id ON public.route_shapes (route_id);
CREATE INDEX IF NOT EXISTS idx_route_variants_route_id ON public.route_variants (route_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_shape_id ON public.route_segments (route_shape_id);
CREATE INDEX IF NOT EXISTS idx_route_transfer_points_r1 ON public.route_transfer_points (route_id_1);
CREATE INDEX IF NOT EXISTS idx_route_transfer_points_r2 ON public.route_transfer_points (route_id_2);
CREATE INDEX IF NOT EXISTS idx_favorite_places_user ON public.favorite_places (user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_routes_user ON public.favorite_routes (user_id);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON public.recent_searches (user_id);
CREATE INDEX IF NOT EXISTS idx_gis_quality_reports_shape ON public.gis_quality_reports (route_shape_id);


-- Row Level Security (RLS) Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_transfer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gis_quality_reports ENABLE ROW LEVEL SECURITY;


-- RLS Policies Setup

-- Profiles Policies
CREATE POLICY "Allow public read access to profiles" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow users to insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Routes Policies
CREATE POLICY "Allow public read access to routes" 
  ON public.routes FOR SELECT USING (true);

-- Route Variants Policies
CREATE POLICY "Allow public read access to route variants" 
  ON public.route_variants FOR SELECT USING (true);

-- Route Shapes Policies
CREATE POLICY "Allow public read access to route shapes" 
  ON public.route_shapes FOR SELECT USING (true);

-- Route Segments Policies
CREATE POLICY "Allow public read access to route segments" 
  ON public.route_segments FOR SELECT USING (true);

-- Route Transfer Points Policies
CREATE POLICY "Allow public read access to route transfer points" 
  ON public.route_transfer_points FOR SELECT USING (true);

-- Places Policies
CREATE POLICY "Allow public read access to places" 
  ON public.places FOR SELECT USING (true);

-- Favorite Places Policies (Restricted to owner)
CREATE POLICY "Allow users to manage their own favorite places" 
  ON public.favorite_places FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Favorite Routes Policies (Restricted to owner)
CREATE POLICY "Allow users to manage their own favorite routes" 
  ON public.favorite_routes FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Recent Searches Policies (Restricted to owner)
CREATE POLICY "Allow users to manage their own recent searches" 
  ON public.recent_searches FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Dataset Versions Policies
CREATE POLICY "Allow public read access to dataset versions" 
  ON public.dataset_versions FOR SELECT USING (true);

-- GIS Quality Reports Policies
CREATE POLICY "Allow public read access to gis quality reports" 
  ON public.gis_quality_reports FOR SELECT USING (true);


-- Trigger to handle profile creation when a new user signs up in auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists first before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;


-- Spatial RPC SQL Functions

-- 1. Find routes passing within a given distance from a point
CREATE OR REPLACE FUNCTION public.find_routes_near_point(
  point_lon DOUBLE PRECISION,
  point_lat DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
)
RETURNS TABLE (
  route_id TEXT,
  route_name TEXT,
  direction TEXT,
  color TEXT,
  casing_color TEXT,
  transport_type TEXT,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS route_id,
    r.name AS route_name,
    s.direction,
    r.color,
    r.casing_color,
    r.transport_type,
    ST_Distance(
      s.geom::geography, 
      ST_SetSRID(ST_MakePoint(point_lon, point_lat), 4326)::geography
    ) AS distance
  FROM 
    public.routes r
  JOIN 
    public.route_shapes s ON r.id = s.route_id
  WHERE 
    s.qa_status = 'approved' AND
    ST_DWithin(
      s.geom::geography, 
      ST_SetSRID(ST_MakePoint(point_lon, point_lat), 4326)::geography, 
      distance_meters
    )
  ORDER BY 
    distance ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Project a point onto a route shape to find the nearest point (virtual boarding/alighting point)
CREATE OR REPLACE FUNCTION public.project_point_onto_route(
  shape_id UUID,
  point_lon DOUBLE PRECISION,
  point_lat DOUBLE PRECISION
)
RETURNS TABLE (
  closest_lon DOUBLE PRECISION,
  closest_lat DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  fraction DOUBLE PRECISION
) AS $$
DECLARE
  route_geom GEOMETRY;
  input_point GEOMETRY;
  projected_point GEOMETRY;
BEGIN
  -- Get the geometry of the route shape
  SELECT geom INTO route_geom FROM public.route_shapes WHERE id = shape_id;
  
  IF route_geom IS NULL THEN
    RETURN;
  END IF;
  
  input_point := ST_SetSRID(ST_MakePoint(point_lon, point_lat), 4326);
  
  -- Find the closest point on the line geometry
  projected_point := ST_ClosestPoint(route_geom, input_point);
  
  RETURN QUERY
  SELECT 
    ST_X(projected_point) AS closest_lon,
    ST_Y(projected_point) AS closest_lat,
    ST_Distance(projected_point::geography, input_point::geography) AS distance_meters,
    ST_LineLocatePoint(route_geom, input_point) AS fraction;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
