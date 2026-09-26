using System;
using System.IO;
using System.Linq;
using UndertaleModLib.Decompiler;
using UndertaleModLib.Compiler;
EnsureDataLoaded();
var context = new GlobalDecompileContext(Data);
var imports = new CodeImportGroup(Data);
string Read(string name) => new Underanalyzer.Decompiler.DecompileContext(context, Data.Code.First(c => c.Name.Content == name), Data.ToolInfo.DecompilerSettings).DecompileToString();
void Replace(string name, string code) => imports.QueueReplace(name, code);
// Start the chapter through its usual initialization, then load only the arena.
Replace("gml_Object_obj_intro_ch3_Create_0", @"
global.filechoice = 0;
global.browser_knight = true;
global.browser_weird = 0;
if (file_exists(""browser-route.txt"")) {
 var routefile = file_text_open_read(""browser-route.txt"");
 global.browser_weird = file_text_read_real(routefile);
 file_text_close(routefile);
}
scr_load();");
Replace("gml_Object_obj_intro_ch3_Step_0", "");
Replace("gml_Object_obj_intro_ch3_Draw_0", "");
string load = Read("gml_GlobalScript_scr_load");
load=load.Replace("myfileid = ossafe_file_text_open_read(file);", "file = global.browser_weird ? \"knight-weird.sav\" : \"knight-normal.sav\";\nmyfileid = ossafe_file_text_open_read(file);");
load=load.Replace("var room_id = global.currentroom;", @"
global.currentroom = 30108;
global.plot = 320;
global.tempflag[90] = 5;
global.knight_mode = 2;
global.kaizo_intro = 0;
global.kaizo_practice = 0;
for (var bh = 1; bh <= 4; bh++) global.hp[bh] = global.maxhp[bh];
var room_id = global.currentroom;");
Replace("gml_GlobalScript_scr_load",load);
string create=Read("gml_Object_obj_ch3_PTB02_Create_0");
create+=@"
con = 4;
customcon = 1;
sword_draw_ready = true;
global.interact = 1;
global.knight_mode = 2;
kr_actor.x=2356; kr_actor.y=104;
su_actor.x=2310; su_actor.y=142;
ra_actor.x=2288; ra_actor.y=190;
roaring_knight.visible=false;
knight_marker = scr_dark_marker(roaring_knight.x, roaring_knight.y, spr_roaringknight_idle);
camera_set_view_pos(view_get_camera(0),2230,0);
";
Replace("gml_Object_obj_ch3_PTB02_Create_0",create);
string step=Read("gml_Object_obj_ch3_PTB02_Step_0");
step=@"
if (con >= 8) {
 if (!variable_global_exists(""browser_result_logged"")) {
  global.browser_result_logged=true;
  show_debug_message(global.flag[50] == 1 ? ""KNIGHT_RESULT:DEFEAT"" : ""KNIGHT_RESULT:VICTORY"");
 }
 exit;
}
"+step;
Replace("gml_Object_obj_ch3_PTB02_Step_0",step);
// The browser package places all external music beside the game.
Replace("gml_GlobalScript_kaizo_settings_init", Read("gml_GlobalScript_kaizo_settings_init").Replace("working_directory + \"../mus/\"", "\"mus/\""));
Replace("gml_Object_obj_knight_enemy_Create_0", Read("gml_Object_obj_knight_enemy_Create_0")+"\nshow_debug_message(\"KNIGHT_READY:\"+string(k_sideb));");
imports.Import();
ScriptMessage("Knight-only browser patch applied; original attack logic preserved.");
