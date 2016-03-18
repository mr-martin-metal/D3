#!/usr/bin/env perl
#===============================================================================
#
#         FILE: make.json.pl
#
#        USAGE: ./make.json.pl  
#
#  DESCRIPTION: 
#
#      OPTIONS: ---
# REQUIREMENTS: ---
#         BUGS: ---
#        NOTES: ---
#       AUTHOR: YOUR NAME (), 
# ORGANIZATION: 
#      VERSION: 1.0
#      CREATED: 03/16/2016 06:44:42 PM
#     REVISION: ---
#===============================================================================

use strict;
use warnings;
use utf8;

my %WALS;
my @Order;
my $rOrder=\@Order;
my $rWALS=\%WALS;

my $line;
my $key;
my $index;
my $count;
my $oCntr;
my ($i,$k);
my $year;
my $month;
my $day;
my $delim;

my $switch;
my ($templateFile, $dataFile);

$oCntr=0;

&processCLI(@ARGV);

open KOKOS, "<$dataFile" or die "Cannot get data";

while(<KOKOS>) {
	$line = $_;
	chomp($line);
	$key=$line;
	$index=$line;
	$count=$line;
	next unless( $line =~ /^\d+/ );
	$key =~ s/(201[0-9]-..-[0-9]+) .*/$1/;
	$index =~ s/.* ([0-9]+):.*/$1/;
	$count =~ s/.*\t(.*)$/$1/;

	$year=$key;
	$month=$key;
	$day=$key;

	$year =~ s/^(....).*/$1/;
	$month =~ s/.*-([0-9]+)-.*/$1/;
	$day =~ s/.*-([0-9]+)$/$1/;

	next if( ($day*1) eq 0 );

	$key = sprintf( "%4.4d-%2.2d-%2.2d", $year, $month, $day );

	unless ( defined $rWALS->{$key} ) {
		$rWALS->{$key} = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
		$rOrder->[$oCntr++]=$key;
	}

	if( defined $rWALS->{$key} ) {
		if( defined $rWALS->{$key}->[$index] ) {
			$rWALS->{$key}->[$index] += $count;
		} else {
			$rWALS->{$key}->[$index] = $count;
		}
	}	
}

close KOKOS;

$oCntr--;

print "{\"itemCount\": $oCntr,\n \"walHistory\": {\n";
$delim=0;
foreach my $k (@Order) {
	if( $delim ) {
		printf( ",\n" );
	} else {
		$delim = 1;
	}
	printf( "\"$k\": [");
	for ( $i=0;$i<23;$i++) {
		printf(  "%d,", $rWALS->{$k}->[$i] );
	}			
	printf( "%d]", 	$rWALS->{$k}->[23] );
}
print "\n},\n";

open TEMPLATE, "<$templateFile" or die "Cannot get template file";

while(<TEMPLATE>) {
	print $_;
}

close TEMPLATE;

exit 0;

sub processCLI {
	my $arg;
	my @arguments=@ARGV;

	while( $arg=shift(@arguments) ) {
		if( $arg and ($arg eq "-t" || $arg eq "--template") ) {
			$templateFile=shift(@arguments);
		}
		if( $arg and ($arg eq "-d" || $arg eq "--data") ) {
			$dataFile=shift(@arguments);
		}
		if( $arg and ($arg eq "-?" || $arg eq "--help") ) {
			&showHelp();
		}
	}
}


sub showHelp {
   select STDERR;
   print STDERR <<EndOfUsage;
Usage: wal-formatter [<options>]
Options:
--------------------------------------------------------------------------------
-t | --template    HTML tempplate file

-d | --data        JSON data file. It must follow the fixed format.

Description: This tool processes the raw data generated by WAL watchdog
in data centers. The data is agregated into hourly profiles and formated
into JSON structure.

EndOfUsage
   exit(0);
}