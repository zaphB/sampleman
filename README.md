SampleMan
=========

Simple browser based tool designed for the experimental sciences, to manage labbooks, images and measurement data of your fabricated samples. A central concept is that the database is entirely based on folder structure and ascii files, such that it can be always read without any special programs.

*What is a sample?* A sample can be anything that is being machined or processed by you and where a precise record of recipe details and observations during the process are of interest. SampleMan creates a sample ID for every sample, which is a combination of a fixed prefix and a number, `XYZ123` for example. The prefix `XYZ` identifies the owner of the sample and the number `123` is the sample number. SampleMan further creates a folder named after this sample ID and stores all applied steps in the plain-text file `labbook.md` within this folder.

*What is a step?* A step is anything that you do to you samples, how fine grained you define what a step is, is entirely decided by yourself. SampleMan creates a labbook entry with time, date and a unique step ID for every step that you do. You can store templates of step descriptions for steps you perform on a regular basis. Files can be attached to steps, which will be stored in sub-folders of the sample folder, which are named after the step ID. If, for example, there is a cleaning step with the step ID 45 and an attached file "microsocopy.jpg", the folder structure of the database would look like this:

```
samples
  | ...
  | other samples
  | ...
  | XYZ132
  |   | labbook.md
  |   | ...
  |   | other steps
  |   | ...   
  |   | 45-cleaning
  |   |   \ microscopy.jpg
  |   | ...
  |   | other steps
  |   \ ...   
  | ...
  | other samples
  \ ...
```


Installation & Running
----------------------

Make sure `node` and `npm` are installed on your system. Open up a shell and run `node --version` and `npm --version`, both should run without an error.

Download or clone this repository. Edit `config.json` and enter existing paths for `dbDir`, which is where your sample database will be created and `uploadDir`, which is the source directory from which attachment files are grabbed later. `samplePrefix` specifies the prefix for every sample folder, if it is `ABC` the samples folders will be named `ABC001`, `ABC002`, etc. `stepIdLen` specifies the digit count of the step counter, with a value of 3 up to 1000 steps can be stored and still maintain equivalence of logical and alphabetic order in the folder names.

Then run `sampleman.sh`, wait until all components are installed and visit `localhost:3000` in your browser. Done.


Creating Your First Sample
--------------------------

If you followed the installation instructions you should now see the following in the right side of the browser screen:

![create-sample.jpg](https://github.com/zaphB/sampleman/blob/master/screenshots/create-sample.jpg?raw=true)

In the sample aim field you can enter a title for your sample, ideally describing why you plan to prepare this sample. In this example I chose "learning about stuff" as the smaple aim. Then hit the "New sample: ..." button to create your first sample entry. Next you should see the following:

![first-sample.jpg](https://github.com/zaphB/sampleman/blob/master/screenshots/first-sample.jpg?raw=true)

The left coloumn shows the overview of all your created samples, which is only one sample so far. The sample names are clickable to open the samples labbook. The central column shows the current sample's labbook, which lists all steps done in chronological order, with the oldest step on the bottom. The labbook should currently be empty. The right column allows to add entries to the labbook.


Adding a Step to a Sample
-------------------------

Enter an "step title" and "step description" and hit "add step". Every line in the "step description" field results in a bullet point in the labbook. If you indent lines in the "step description" field  with spaces, you can create different levels in the bullet point list.

In this example, I created the following first step:

![first-step.jpg](https://github.com/zaphB/sampleman/blob/master/screenshots/first-step.jpg?raw=true)

As you can see, the date, time and an step ID (001 here) are automatically added.


Using Templates
---------------

Entering title and description manually every time you add a step is cumbersome. Because you usually do the same or similar step with many samples, templates with placeholders are very helpful to speed things up. For this, create a plain-text file in the `templates` folder within your `dbDir` folder.

In the first line of the file, write the desired step title. In the following lines, write the desired step description. You can use underscores as placeholders, for text that should be filled in individually for every sample. For example:

```
Standard cleaning

Immerse sample in solvent ___ for __mins
Let sample dry for ___mins
Inspect sample surface: __________
```

The filename should end with `.txt`, and it is recommended not to use spaces. The templates are listed in alphabetical order of their filenames, a leading number can thus be used to achieve a custom sorting. In this example, the filename `01-cleaning.txt` is chosen. After creating the file, reload the SampleMan frontend in the browser. A new button should appear in the "Load Template" section:

![first-template.jpg](https://github.com/zaphB/sampleman/blob/master/screenshots/first-template.jpg?raw=true)

Click it to fill in the "step title" and "step description" fields with the template content. Use the "tab" key to select the placeholders in the step description and enter the desired values. After tabbing through and replacing all placeholders, either press the "add step" button or use "ctrl+enter" to save the step.


Attaching Files to a Step
-------------------------

Next, we want to add some additional files to this step entry. In practice this could be microscopy images or measurement results for example. To add any file, we need the "attach files" section in the bottom right:

![attach-files.jpg](https://github.com/zaphB/sampleman/blob/master/screenshots/attach-files.jpg?raw=true)

There are two possible sources to upload a file from: Directly selecting files via the "choose files" button, or from the local upload folder, which is the directory specified as `updloadDir` in `config.json`. Checking the "Use local upload folder instead of direct file upload"-checkbox selects the second option, leaving it unchecked uses files selected with the "choose files" dialog.

In the "Identify with step ID"-input, you can optionally enter a step ID to identify the selected files with. If this input remains empty, the files are identified with the latest step.

In the "Upload file count"-input, you can enter a number to limit the amount of files selected from the local upload folder. If left free, all files contained in the local upload folder are used. This setting is ignored if the "choose files" dialog is used as a source for files.

The uploaded files are added to a folder corresponding to the step. The folder is automatically created if it does not exist. The folder name must begin with the step ID, the rest of the name can be changed at will. By default, the folder name is created from the longest word in the step title.

Attached image files in the `jpg` or `png` formats are displayed in the sample gallery in chronological order. The labbook/gallery view can be toggled with the `[imgs]`/`[labbook]` links that appear if there are images attached to a sample:

![gallery.jpg](https://github.com/zaphB/sampleman/blob/master/screenshots/gallery.jpg?raw=true)
