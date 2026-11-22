using System;
using System.IO;
using System.Linq;
using UndertaleModLib.Decompiler;
using UndertaleModLib.Compiler;

EnsureDataLoaded();

var context = new GlobalDecompileContext(Data);
var imports = new CodeImportGroup(Data);

void RequireCode(string name)
{
    if (!Data.Code.Any(c => c.Name.Content == name))
        throw new Exception("Required game resource is missing: " + name);
}

string Read(string name)
{
    RequireCode(name);
    var code = Data.Code.First(c => c.Name.Content == name);
    return new Underanalyzer.Decompiler.DecompileContext(
        context, code, Data.ToolInfo.DecompilerSettings
    ).DecompileToString();
}

void Replace(string name, string code)
{
    RequireCode(name);
    if (code == null)
        throw new Exception("Replacement code is null: " + name);
    imports.QueueReplace(name, code);
}

int CountOccurrences(string source, string value)
{
    int count = 0;
    int index = 0;
    while ((index = source.IndexOf(value, index, StringComparison.Ordinal)) >= 0)
    {
        count++;
        index += value.Length;
    }
    return count;
}

string ReplaceExactlyOnce(string source, string oldText, string newText, string resourceName)
{
    int count = CountOccurrences(source, oldText);
    if (count != 1)
        throw new Exception(
            "Compatibility check failed in " + resourceName +
            ": expected one match, found " + count +
            ". The 3.0 source code differs from the expected pattern."
        );
    return source.Replace(oldText, newText);
}

// Check all required resources before queuing any changes.
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

foreach (string resource in requiredResources)
    RequireCode(resource);

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
load = ReplaceExactlyOnce(
    load,
    "myfileid = ossafe_file_text_open_read(file);",
    @"file = global.browser_weird ? ""knight-weird.sav"" : ""knight-normal.sav"";
myfileid = ossafe_file_text_open_read(file);",
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
Replace("gml_GlobalScript_scr_load", load);

string create = Read("gml_Object_obj_ch3_PTB02_Create_0");
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
Replace("gml_Object_obj_ch3_PTB02_Create_0", create);

string step = Read("gml_Object_obj_ch3_PTB02_Step_0");
step = @"
if (con >= 8) {
 if (!variable_global_exists(""browser_result_logged"")) {
  global.browser_result_logged=true;
  show_debug_message(global.flag[50] == 1 ? ""KNIGHT_RESULT:DEFEAT"" : ""KNIGHT_RESULT:VICTORY"");
 }
 exit;
}
" + step;
Replace("gml_Object_obj_ch3_PTB02_Step_0", step);

// The browser package places all external music beside the game.
string settings = Read("gml_GlobalScript_kaizo_settings_init");
settings = ReplaceExactlyOnce(
    settings,
    "working_directory + ""../mus/""",
    "\"mus/\"",
    "gml_GlobalScript_kaizo_settings_init"
);
Replace("gml_GlobalScript_kaizo_settings_init", settings);

Replace(
    "gml_Object_obj_knight_enemy_Create_0",
    Read("gml_Object_obj_knight_enemy_Create_0") +
    "\nshow_debug_message(\"KNIGHT_READY:\"+string(k_sideb));"
);

imports.Import();
ScriptMessage("Knight-only browser patch applied. Required resources and source patterns passed compatibility checks; original attack logic preserved.");