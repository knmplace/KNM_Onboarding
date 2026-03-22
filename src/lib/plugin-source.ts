/**
 * KNM Onboarding Helper — WordPress plugin source
 * Single source of truth used by the download endpoint and install-plugin route.
 */

export const PLUGIN_SLUG = "knm-onboarding-helper";

export function buildZip(folderName: string, filename: string, content: string): Buffer {
  const fileData = Buffer.from(content, "utf-8");
  const entryPath = `${folderName}/${filename}`;
  const entryPathBuf = Buffer.from(entryPath, "utf-8");
  const now = new Date();
  const dosDate = dosDateTime(now);
  const crc = crc32(fileData);
  const fileSize = fileData.length;
  const pathLen = entryPathBuf.length;

  const localHeader = Buffer.alloc(30 + pathLen);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosDate.time, 10);
  localHeader.writeUInt16LE(dosDate.date, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(fileSize, 18);
  localHeader.writeUInt32LE(fileSize, 22);
  localHeader.writeUInt16LE(pathLen, 26);
  localHeader.writeUInt16LE(0, 28);
  entryPathBuf.copy(localHeader, 30);

  const localEntrySize = localHeader.length + fileSize;

  const centralEntry = Buffer.alloc(46 + pathLen);
  centralEntry.writeUInt32LE(0x02014b50, 0);
  centralEntry.writeUInt16LE(20, 4);
  centralEntry.writeUInt16LE(20, 6);
  centralEntry.writeUInt16LE(0, 8);
  centralEntry.writeUInt16LE(0, 10);
  centralEntry.writeUInt16LE(dosDate.time, 12);
  centralEntry.writeUInt16LE(dosDate.date, 14);
  centralEntry.writeUInt32LE(crc, 16);
  centralEntry.writeUInt32LE(fileSize, 20);
  centralEntry.writeUInt32LE(fileSize, 24);
  centralEntry.writeUInt16LE(pathLen, 28);
  centralEntry.writeUInt16LE(0, 30);
  centralEntry.writeUInt16LE(0, 32);
  centralEntry.writeUInt16LE(0, 34);
  centralEntry.writeUInt16LE(0, 36);
  centralEntry.writeUInt32LE(0, 38);
  centralEntry.writeUInt32LE(0, 42);
  entryPathBuf.copy(centralEntry, 46);

  const cdOffset = localEntrySize;
  const cdSize = centralEntry.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, fileData, centralEntry, eocd]);
}

function dosDateTime(d: Date): { date: number; time: number } {
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return { date, time };
}

function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
export const PLUGIN_FILENAME = "knm-onboarding-helper.php";

export const PLUGIN_PHP = `<?php
/**
 * Plugin Name: KNM Onboarding Helper
 * Description: Tracks password changes and login activity for the KNM Onboarding system. Required for accurate onboarding status tracking.
 * Version:     1.2
 * Author:      KNM Place
 * License:     GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) exit;

function knm_ob_set_last_password_change( $user_id ) {
    update_user_meta( $user_id, 'last_password_change', wp_date( 'c' ) );
}

function knm_ob_set_last_login_at( $user_id ) {
    update_user_meta( $user_id, 'last_login_at', wp_date( 'c' ) );
}

add_action( 'after_password_reset', function( $user ) {
    knm_ob_set_last_password_change( $user->ID );
} );

add_action( 'wp_set_password', function( $password, $user_id, $old_user_data ) {
    knm_ob_set_last_password_change( $user_id );
}, 10, 3 );

add_action( 'profile_update', function( $user_id, $old_user_data, $userdata ) {
    if ( ! empty( $userdata['user_pass'] ) ) {
        knm_ob_set_last_password_change( $user_id );
    }
}, 10, 3 );

add_action( 'wp_login', function( $user_login, $user ) {
    if ( $user && isset( $user->ID ) ) {
        knm_ob_set_last_login_at( (int) $user->ID );
    }
}, 10, 2 );

add_action( 'set_logged_in_cookie', function( $logged_in_cookie, $expire, $expiration, $user_id ) {
    if ( ! empty( $user_id ) ) {
        knm_ob_set_last_login_at( (int) $user_id );
    }
}, 10, 4 );

add_action( 'rest_api_init', function() {
    register_meta( 'user', 'last_password_change', [
        'type'         => 'string',
        'single'       => true,
        'show_in_rest' => true,
        'description'  => 'ISO timestamp of last password change',
    ] );
    register_meta( 'user', 'last_login_at', [
        'type'         => 'string',
        'single'       => true,
        'show_in_rest' => true,
        'description'  => 'ISO timestamp of most recent successful login',
    ] );
} );
`;
