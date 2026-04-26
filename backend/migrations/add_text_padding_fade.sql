-- Migration: Yazi padding (ust/alt kenar boslugu) ve fade in/out efekti alanlari
-- transcode_jobs tablosuna yeni kolonlar eklenir
-- Tarih: 2026-04-26

-- Yazi alt/ust kenar boslugu (piksel cinsinden)
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_padding_top INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_padding_bottom INTEGER NOT NULL DEFAULT 0;

-- Yazi gorunme/kaybolma efekti (fade in/out)
-- text_fade_enabled: Efektin aktif olup olmadigi
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_fade_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- text_fade_interval: Kac saniyede bir dongu (ornek 600 = 10 dakika)
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_fade_interval INTEGER NOT NULL DEFAULT 600;

-- text_fade_duration: Her dongude kac saniye gizli kalacak
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_fade_duration INTEGER NOT NULL DEFAULT 20;

-- text_fade_in_time: Yazi geri gelirken kac saniyede belirecek (saniye)
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_fade_in_time INTEGER NOT NULL DEFAULT 3;

-- text_fade_out_time: Yazi kaybolurken kac saniyede soluklaşacak (saniye)
ALTER TABLE transcode_jobs ADD COLUMN IF NOT EXISTS text_fade_out_time INTEGER NOT NULL DEFAULT 3;
