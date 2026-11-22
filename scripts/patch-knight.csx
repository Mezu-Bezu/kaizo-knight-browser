using System;
using System.IO;
using System.Linq;
using UndertaleModLib.Decompiler;
using UndertaleModLib.Compiler;

// Fail closed: never export a partially patched game.
EnsureDataLoaded();

var context = new GlobalDecompileContext(Data);
var imports = new CodeImportGroup(Data);

void RequireCode(string name)
{
    if (!Data.Code.Any(c => c.Name.Content == name))
        throw new Exception("Required GameMaker code resource is missing: " + name);
}

string ReadCode(string name)
{
    RequireCode(name);
    var code = Data.Code.First(c => c.Name.Content == name);
    return new Underanalyzer.Decompiler.DecompileContext(
        context, code, Data.ToolInfo.DecompilerSettings
    ).DecompileToString();
}

void QueueReplace(string name, string code)
{
    RequireCode(name);
    imports.QueueReplace(name, code);
}

string ReplaceExactlyOnce(string source, string oldText, string newText, string label)
{
    int first = source.IndexOf(oldText, StringComparison.Ordinal);
    if (first < 0)
        throw new Exception("Patch anchor not found in " + label + ": " + oldText);

    int second = source.IndexOf(oldText, first + oldText.Length, StringComparison.Ordinal);
    if (second >= 0)
        throw new Exception("Patch anchor occurs more than once in " + label + ": " + oldText);

    return source.Substring(0, first) + newText +
           source.Substring(first + oldText.Length);
}

// Check every resource before queuing any changes.
string[] requiredResources = new string[]
{
    "gml_Object_obj_intro_ch3_Create_0",
    "gml_Object_obj_intro_ch3_Step_0",
    "gml_Object_obj_intro_ch3_Draw_0",
    "gml_GlobalScript_scr_load",
    "gml_Object_obj_ch3_PTB02_Create_0",
    "gml_Object_obj_ch3_PTB02_Step_0",
    "gml_GlobalScript_kaizo_settings_init",
    "gml_Object_obj_knight_enemy_Create_0"
};

foreach (string name in requiredResources)
    RequireCode(name);

// Start the chapter through its usual initialization, then load the arena.
QueueReplace("gml_Object_obj_intro_ch3_Create_0", @"
global.filechoice = 0;
global.browser_knight = true;
global.browser_weird = 0;
if (file_exists(""browser-route.txt"")) {
 var routefile = file_text_open_read(""browser-route.txt"");
 global.browser_weird = file_text_read_real(routefile);
 file_text_close(routefile);
}
scr_load();");

QueueReplace("gml_Object_obj_intro_ch3_Step_0", "");
QueueReplace("gml_Object_obj_intro_ch3_Draw_0", "");

string load = ReadCode("gml_GlobalScript_scr_load");
load = ReplaceExactlyOnce(
    load,
    "myfileid = ossafe_file_text_open_read(file);",
    @"file = global.browser_weird ? ""knight-weird.sav"" : ""knight-normal.sav"";" + "\n" +
    "myfileid = ossafe_file_text_open_read(file);",
    "gml_GlobalScript_scr_load"
);

load = ReplaceExactlyOnce(
    load,
    "var room_id = global.currentroom;",
    @"
global.currentroom = 30108;
global.plot = 320;
global.tempflag[90] = 5;
global.knight_mode = 2;
global.kaizo_intro = 0;
global.kaizo_practice = 0;
for (var bh = 1; bh <= 4; bh++) global.hp[bh] = global.maxhp[bh];
var room_id = global.currentroom;",
    "gml_GlobalScript_scr_load"
);
QueueReplace("gml_GlobalScript_scr_load", load);

string create = ReadCode("gml_Object_obj_ch3_PTB02_Create_0");
create += @"
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
QueueReplace("gml_Object_obj_ch3_PTB02_Create_0", create);

string step = ReadCode("gml_Object_obj_ch3_PTB02_Step_0");
step = @"
if (con >= 8) {
 if (!variable_global_exists(""browser_result_logged"")) {
  global.browser_result_logged=true;
  show_debug_message(global.flag[50] == 1 ? ""KNIGHT_RESULT:DEFEAT"" : ""KNIGHT_RESULT:VICTORY"");
 }
 exit;
}
" + step;
QueueReplace("gml_Object_obj_ch3_PTB02_Step_0", step);

// The browser package places external music beside the game.
string settings = ReadCode("gml_GlobalScript_kaizo_settings_init");
settings = ReplaceExactlyOnce(
    settings,
    "working_directory + ""../mus/""",
    "\"mus/\"",
    "gml_GlobalScript_kaizo_settings_init"
);
QueueReplace("gml_GlobalScript_kaizo_settings_init", settings);

string enemyCreate = ReadCode("gml_Object_obj_knight_enemy_Create_0");
enemyCreate += "\nshow_debug_message(\"KNIGHT_READY:\"+string(k_sideb));";
QueueReplace("gml_Object_obj_knight_enemy_Create_0", enemyCreate);

// Import only after all required resources and replacement anchors passed validation.
imports.Import();
ScriptMessage("Knight browser patch applied. Required resources and patch anchors were validated.");